// supabase/functions/scheduler-run/index.ts
// Canonical scheduling endpoint used by the Schedule Board and our approval proxy.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

type RunRequest = {
  commit?: boolean;
  proposed?: boolean;
  onlyIfUnset?: boolean;
  nuclear?: boolean;
  wipeAll?: boolean;
  startFrom?: string | null;     // YYYY-MM-DD or ISO
  onlyJobIds?: string[] | null;  // Restrict scope
  baseStart?: string | null;     // Optional explicit ISO for append
};

type RunResult = {
  ok: boolean;
  jobs_considered: number;
  stages_scheduled: number;
  applied: { updated: number; inserted_slots: number };
  note?: string;
  error?: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY")!;
if (!SUPABASE_URL || !SRK) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY env var");
}

function sb(): SupabaseClient {
  return createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });
}

// ------------ Shift Calendar helpers ------------
type DaySchedule = { is_working_day: boolean; start_time: string; end_time: string };
type ShiftMap = Record<number, DaySchedule>;

async function loadShiftCalendar(s: SupabaseClient): Promise<ShiftMap> {
  const map: ShiftMap = {};
  const { data, error } = await s
    .from("shift_schedules")
    .select("day_of_week,is_working_day,start_time,end_time")
    .order("day_of_week");
  if (error) throw new Error(`loadShiftCalendar: ${error.message}`);
  for (const r of data ?? []) map[r.day_of_week] = r as unknown as DaySchedule;
  return map;
}

async function isHoliday(s: SupabaseClient, ymd: string): Promise<boolean> {
  const { data, error } = await s
    .from("public_holidays")
    .select("date,is_active")
    .eq("date", ymd)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`isHoliday: ${error.message}`);
  return !!data;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function makeDayStart(d: Date, startHHmm: string): Date {
  // startHHmm like "08:00:00"
  const [H, M, S] = startHHmm.split(":").map((x) => parseInt(x, 10));
  const x = new Date(d);
  x.setUTCHours(H ?? 8, M ?? 0, S ?? 0, 0);
  return x;
}
function makeDayEnd(d: Date, endHHmm: string): Date {
  const [H, M, S] = endHHmm.split(":").map((x) => parseInt(x, 10));
  const x = new Date(d);
  x.setUTCHours(H ?? 16, M ?? 30, S ?? 0, 0);
  return x;
}

async function nextWorkingStart(s: SupabaseClient, calendar: ShiftMap, from: Date): Promise<Date> {
  let d = new Date(from);
  // If date string like "YYYY-MM-DD", treat as day start
  if (/^\d{4}-\d{2}-\d{2}$/.test(from.toString())) d = new Date(`${from}T00:00:00Z`);

  while (true) {
    const dow = d.getUTCDay();
    const sched = calendar[dow];
    const dayStart = sched ? makeDayStart(d, sched.start_time) : makeDayStart(d, "08:00:00");
    const dayEnd   = sched ? makeDayEnd(d, sched.end_time)   : makeDayEnd(d, "16:30:00");

    // weekends / non-working days / holidays
    const notWorking = !sched?.is_working_day || (await isHoliday(s, ymd(d)));
    if (notWorking || d > dayEnd) {
      // move to next day at scheduled start
      const nx = new Date(d.getTime() + 24 * 60 * 60 * 1000);
      nx.setUTCHours(0, 0, 0, 0);
      d = makeDayStart(nx, calendar[nx.getUTCDay()]?.start_time ?? "08:00:00");
      continue;
    }
    if (d < dayStart) return dayStart;
    if (d >= dayStart && d <= dayEnd) return d;
    // else bump to next day start
    const nx = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    nx.setUTCHours(0, 0, 0, 0);
    d = makeDayStart(nx, calendar[nx.getUTCDay()]?.start_time ?? "08:00:00");
  }
}

function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

/** Split a duration into one or more working slices according to the shift calendar. */
async function allocateSlots(
  s: SupabaseClient,
  calendar: ShiftMap,
  start: Date,
  durationMinutes: number,
): Promise<Array<{ start: Date; end: Date }>> {
  let curStart = await nextWorkingStart(s, calendar, start);
  let remaining = Math.max(1, Math.floor(durationMinutes));

  const slots: Array<{ start: Date; end: Date }> = [];
  while (remaining > 0) {
    const dow = curStart.getUTCDay();
    const sched = calendar[dow];
    const dayEnd = sched ? makeDayEnd(curStart, sched.end_time) : makeDayEnd(curStart, "16:30:00");

    const available = Math.max(0, Math.ceil((dayEnd.getTime() - curStart.getTime()) / 60000));
    if (available <= 0) {
      curStart = await nextWorkingStart(s, calendar, addMinutes(curStart, 1));
      continue;
    }

    const take = Math.min(available, remaining);
    const curEnd = addMinutes(curStart, take);
    slots.push({ start: curStart, end: curEnd });

    remaining -= take;
    curStart = await nextWorkingStart(s, calendar, curEnd);
  }
  return slots;
}

// ------------ Core scheduling ------------
type JSI = {
  id: string;
  job_id: string;
  production_stage_id: string;
  stage_order: number | null;
  status: string | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  scheduled_minutes: number | null;
  est_minutes: number | null;  // some schemas call this estimated minutes
  setup_minutes: number | null;
  stage_name: string;
  wo_no: string;
  proof_approved_at: string | null;
};

async function getQueueTail(s: SupabaseClient, stageId: string): Promise<Date | null> {
  const { data, error } = await s
    .from("stage_time_slots")
    .select("slot_end_time")
    .eq("production_stage_id", stageId)
    .order("slot_end_time", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getQueueTail: ${error.message}`);
  return data?.slot_end_time ? new Date(data.slot_end_time as unknown as string) : null;
}

async function loadCandidateStages(
  s: SupabaseClient,
  onlyJobIds: string[] | undefined,
  onlyIfUnset: boolean,
): Promise<JSI[]> {
  const q = s
    .from("job_stage_instances")
    .select(`
      id, job_id, production_stage_id, stage_order, status,
      scheduled_start_at, scheduled_end_at, scheduled_minutes,
      est_minutes, setup_minutes,
      production_stages:production_stage_id(name),
      production_jobs:job_id(wo_no, proof_approved_at)
    ` as any)
    .in("status", ["pending", "queued"]); // we only schedule pending/queued

  if (onlyJobIds && onlyJobIds.length) q.in("job_id", onlyJobIds);

  const { data, error } = await q;
  if (error) throw new Error(`loadCandidateStages: ${error.message}`);

  // Transform shape from join
  const out: JSI[] = (data ?? []).map((r: any) => ({
    id: r.id,
    job_id: r.job_id,
    production_stage_id: r.production_stage_id,
    stage_order: r.stage_order,
    status: r.status,
    scheduled_start_at: r.scheduled_start_at,
    scheduled_end_at: r.scheduled_end_at,
    scheduled_minutes: r.scheduled_minutes,
    est_minutes: r.est_minutes ?? null,
    setup_minutes: r.setup_minutes ?? null,
    stage_name: r.production_stages?.name ?? "",
    wo_no: r.production_jobs?.wo_no ?? "",
    proof_approved_at: r.production_jobs?.proof_approved_at ?? null,
  }));

  // Optional filter for onlyIfUnset
  return onlyIfUnset ? out.filter((x) => !x.scheduled_start_at) : out;
}

async function wipeAllFutureSlots(s: SupabaseClient) {
  const nowIso = new Date().toISOString();
  const { error } = await s.from("stage_time_slots").delete().gte("slot_start_time", nowIso);
  if (error) throw new Error(`wipeAllFutureSlots: ${error.message}`);
}

async function executeScheduler(
  s: SupabaseClient,
  req: Required<Pick<RunRequest, "commit" | "proposed" | "onlyIfUnset" | "nuclear" | "wipeAll">> & {
    startFromISO: string;
    onlyJobIds: string[];
  },
): Promise<RunResult> {
  const calendar = await loadShiftCalendar(s);

  if (req.nuclear || req.wipeAll) {
    await wipeAllFutureSlots(s);
  }

  // Who are we scheduling?
  const jsis = await loadCandidateStages(s, req.onlyJobIds, req.onlyIfUnset);

  // Order by job, then stage order, but prefer approved jobs
  jsis.sort((a, b) => {
    const ap = a.proof_approved_at ? 0 : 1;
    const bp = b.proof_approved_at ? 0 : 1;
    if (ap !== bp) return ap - bp;
    if (a.job_id !== b.job_id) return a.job_id.localeCompare(b.job_id);
    return (a.stage_order ?? 9999) - (b.stage_order ?? 9999);
  });

  const jobsConsidered = new Set<string>();
  const prevEndByJob = new Map<string, Date>(); // latest end inside the job
  const tailByStage   = new Map<string, Date>(); // queue tail per stage

  let insertedSlots = 0;
  let stageUpdates  = 0;

  const startFromBase = await nextWorkingStart(s, calendar, new Date(req.startFromISO));

  // Process by job in order
  for (const x of jsis) {
    jobsConsidered.add(x.job_id);

    // Skip jobs without approval, unless you want to allow pre-scheduling
    if (!x.proof_approved_at) continue;

    // minutes to schedule
    const base = (x.scheduled_minutes ?? x.est_minutes ?? 1) as number;
    const setup = x.setup_minutes ?? 0;
    const totalMinutes = Math.max(1, Math.floor(base + setup));

    // previous end inside this job
    const prevEnd = prevEndByJob.get(x.job_id) ?? startFromBase;

    // queue tail for this stage
    let tail = tailByStage.get(x.production_stage_id);
    if (!tail) {
      tail = (await getQueueTail(s, x.production_stage_id)) ?? startFromBase;
      tailByStage.set(x.production_stage_id, tail);
    }

    // earliest feasible start = max(prevEnd, tail, global startFrom)
    const candidate = new Date(Math.max(prevEnd.getTime(), tail.getTime(), startFromBase.getTime()));
    const slots = await allocateSlots(s, calendar, candidate, totalMinutes);

    const scheduledStart = slots[0].start;
    const scheduledEnd   = slots[slots.length - 1].end;

    if (req.commit) {
      // insert time slots (one row per slice; if you prefer a single contiguous row, the calendar split may create >1)
      const rows = slots.map((sl) => ({
        production_stage_id: x.production_stage_id,
        stage_instance_id: x.id,                  // IMPORTANT: used by your board queries
        slot_start_time: sl.start.toISOString(),
        slot_end_time: sl.end.toISOString(),
      }));
      if (rows.length) {
        const { error } = await s.from("stage_time_slots").insert(rows);
        if (error) throw new Error(`insert stage_time_slots: ${error.message}`);
        insertedSlots += rows.length;
      }

      // update JSI summary fields
      const { error: uerr } = await s
        .from("job_stage_instances")
        .update({
          scheduled_start_at: scheduledStart.toISOString(),
          scheduled_end_at:   scheduledEnd.toISOString(),
          scheduled_minutes:  totalMinutes,
        })
        .eq("id", x.id);
      if (uerr) throw new Error(`update job_stage_instances: ${uerr.message}`);
      stageUpdates++;
    }

    // advance pointers
    prevEndByJob.set(x.job_id, scheduledEnd);
    tailByStage.set(x.production_stage_id, scheduledEnd);
  }

  return {
    ok: true,
    jobs_considered: jobsConsidered.size,
    stages_scheduled: stageUpdates,
    applied: { updated: stageUpdates, inserted_slots: insertedSlots },
  };
}

serve(async (req) => {
  try {
    const body = (await req.json().catch(() => ({}))) as RunRequest;

    const commit      = body.commit      ?? true;
    const proposed    = body.proposed    ?? false;
    const onlyIfUnset = body.onlyIfUnset ?? false;
    const nuclear     = body.nuclear     ?? false;
    const wipeAll     = body.wipeAll     ?? false;
    const onlyJobIds  = (body.onlyJobIds ?? []) as string[];

    // Determine normalized start
    const calendar = await loadShiftCalendar(sb());
    const baseStart = body.baseStart ?? body.startFrom ?? new Date().toISOString();
    const normalized = await nextWorkingStart(sb(), calendar, new Date(baseStart));

    // Execute
    const result = await executeScheduler(sb(), {
      commit, proposed, onlyIfUnset, nuclear, wipeAll,
      startFromISO: normalized.toISOString(),
      onlyJobIds,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("scheduler-run error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
