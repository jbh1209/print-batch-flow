// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

type ScheduleRequest = {
  commit?: boolean;
  proposed?: boolean;
  onlyIfUnset?: boolean;
  nuclear?: boolean;
  wipeAll?: boolean;
  startFrom?: string;     // ISO date (YYYY-MM-DD) or ISO datetime
  onlyJobIds?: string[];  // subset of jobs to schedule
};

type StageRow = {
  stage_instance_id: string;
  production_stage_id: string;
  job_id: string;
  wo_no: string;
  stage_order: number | null;
  scheduled_minutes: number | null;     // from JSI (preferred)
  estimated_duration_minutes: number | null; // fallback
};

type Slot = {
  id?: string;
  production_stage_id: string;
  date: string;               // YYYY-MM-DD
  slot_start_time: string;    // ISO z
  slot_end_time: string;      // ISO z
  duration_minutes: number;
  job_id: string;
  job_table_name: "production_jobs";
  stage_instance_id: string;
  is_completed: boolean;
};

const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY envs.");
}

function json(status: number, body: any) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

function asDateOnlyUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addMinutes(ts: Date, mins: number) {
  const d = new Date(ts.getTime());
  d.setUTCMinutes(d.getUTCMinutes() + mins);
  return d;
}

async function normalizeStart(
  sb: SupabaseClient,
  requested?: string,
): Promise<Date> {
  // If a date comes in, use 08:00:00 that day; if datetime, keep it.
  let base = requested ? new Date(requested) : new Date();
  if (!requested || /^\d{4}-\d{2}-\d{2}$/.test(requested)) {
    // bump to 08:00 UTC of that day (your shift table is UTC in DB)
    const d = requested ? new Date(requested + "T08:00:00Z") : base;
    base = d;
  }
  // If it's in the past, nudge forward to now (but round up to whole minute)
  const now = new Date();
  if (base.getTime() < now.getTime()) {
    base = new Date(Math.ceil(now.getTime() / (60_000)) * 60_000);
  }
  // If outside working times or weekend/holiday, bump to next work start.
  const next = await nextWorkingStart(sb, base);
  return next;
}

async function nextWorkingStart(sb: SupabaseClient, fromTs: Date): Promise<Date> {
  // Pull a single day's rule and loop forward until we hit a valid slot start.
  // Schema:
  //   shift_schedules(day_of_week int, shift_start_time time, shift_end_time time, is_working_day bool)
  //   public_holidays(date date, is_active bool)
  let ts = new Date(fromTs.getTime());
  for (let guard = 0; guard < 30; guard++) {
    const dow = ts.getUTCDay(); // 0=Sun..6=Sat
    const { data: rules, error } = await sb
      .from("shift_schedules")
      .select("day_of_week,shift_start_time,shift_end_time,is_working_day")
      .eq("day_of_week", dow)
      .maybeSingle();
    if (error) throw error;

    // Check holiday
    const { data: h } = await sb
      .from("public_holidays")
      .select("date,is_active")
      .eq("date", asDateOnlyUTC(ts))
      .eq("is_active", true);

    const isHoliday = (h && h.length > 0);

    if (rules && rules.is_working_day && !isHoliday) {
      // Build the shift start/end for today in UTC
      const start = new Date(`${asDateOnlyUTC(ts)}T${rules.shift_start_time}Z`);
      const end = new Date(`${asDateOnlyUTC(ts)}T${rules.shift_end_time}Z`);
      if (ts < start) return start;
      if (ts >= start && ts < end) return ts; // already inside shift window
    }

    // advance one day to 08:00
    const nextDay = new Date(ts.getTime());
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    ts = new Date(`${asDateOnlyUTC(nextDay)}T08:00:00Z`);
  }
  return ts;
}

async function selectJobStageRows(
  sb: SupabaseClient,
  req: ScheduleRequest,
): Promise<StageRow[]> {
  let q = sb.from("job_stage_instances")
    .select(`
      stage_instance_id:id,
      production_stage_id,
      job_id,
      wo_no:production_jobs(wo_no),
      stage_order,
      scheduled_minutes,
      estimated_duration_minutes
    `)
    .neq("status", "completed")            // don’t reschedule done work
    .order("job_id", { ascending: true })  // First by job_id to group jobs together
    .order("stage_order", { ascending: true, nullsFirst: false }); // Then by stage order within each job

  if (req.onlyJobIds && req.onlyJobIds.length > 0) {
    q = q.in("job_id", req.onlyJobIds);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data as any[]).map((r) => ({
    stage_instance_id: r.stage_instance_id,
    production_stage_id: r.production_stage_id,
    job_id: r.job_id,
    wo_no: r.wo_no?.wo_no ?? "",
    stage_order: r.stage_order,
    scheduled_minutes: r.scheduled_minutes,
    estimated_duration_minutes: r.estimated_duration_minutes,
  }));
}

function minutesFor(row: StageRow): number {
  // Prefer the per-JSI minutes; otherwise the estimate; final fallback 1
  const m = row.scheduled_minutes ?? row.estimated_duration_minutes ?? 1;
  return Math.max(1, m | 0);
}

async function wipeSlotsIfNeeded(sb: SupabaseClient, req: ScheduleRequest) {
  if (req.nuclear || req.wipeAll) {
    const { error } = await sb.from("stage_time_slots").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw error;
  }
}

async function queueTail(
  sb: SupabaseClient,
  stageId: string,
  base: Date,
): Promise<Date> {
  // last end at for stage, but never in the past; also respect shift windows
  const { data, error } = await sb
    .from("stage_time_slots")
    .select("slot_end_time")
    .eq("production_stage_id", stageId)
    .order("slot_end_time", { ascending: false })
    .limit(1);
  if (error) throw error;

  const last = (data && data.length > 0) ? new Date(data[0].slot_end_time) : null;
  const seed = last && last > base ? last : base;
  return await nextWorkingStart(sb, seed);
}

async function writeSlots(sb: SupabaseClient, slots: Slot[]) {
  if (slots.length === 0) return;
  const { error } = await sb.from("stage_time_slots").insert(
    slots.map(s => ({
      production_stage_id: s.production_stage_id,
      date: s.date,
      slot_start_time: s.slot_start_time,
      slot_end_time: s.slot_end_time,
      duration_minutes: s.duration_minutes,
      job_id: s.job_id,
      job_table_name: s.job_table_name,
      stage_instance_id: s.stage_instance_id,
      is_completed: false,
    }))
  );
  if (error) throw error;
}

async function updateJSI(
  sb: SupabaseClient,
  jsiId: string,
  mins: number,
  startIso: string,
  endIso: string,
) {
  // *** IMPORTANT: UPDATE ONLY – never insert and never touch status ***
  const { error } = await sb
    .from("job_stage_instances")
    .update({
      scheduled_minutes: mins,
      scheduled_start_at: startIso,
      scheduled_end_at: endIso,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jsiId);
  if (error) throw error;
}

async function schedule(
  sb: SupabaseClient,
  req: ScheduleRequest,
): Promise<{ slots: number; jsis: number }> {
  const baseStart = await normalizeStart(sb, req.startFrom);
  await wipeSlotsIfNeeded(sb, req);

  const rows = await selectJobStageRows(sb, req);

  // Keep a moving pointer (tail) per machine/stage
  const tails = new Map<string, Date>();
  // Track job completion times to ensure precedence within jobs
  const jobTails = new Map<string, Date>();
  const slotsToWrite: Slot[] = [];
  let jsiUpdates = 0;

  for (const row of rows) {
    const mins = minutesFor(row);

    // Initialize machine tail if not set
    if (!tails.has(row.production_stage_id)) {
      const t = await queueTail(sb, row.production_stage_id, baseStart);
      tails.set(row.production_stage_id, t);
    }

    // Get the machine's current tail
    let machineStart = new Date(tails.get(row.production_stage_id)!.getTime());
    
    // Ensure this stage starts after the previous stage of the same job completes
    const jobTail = jobTails.get(row.job_id);
    if (jobTail && jobTail > machineStart) {
      machineStart = new Date(jobTail.getTime());
    }

    // Ensure we're within working windows
    const start = await nextWorkingStart(sb, machineStart);
    const end = addMinutes(start, mins);

    // prepare slot row
    slotsToWrite.push({
      production_stage_id: row.production_stage_id,
      date: asDateOnlyUTC(start),
      slot_start_time: start.toISOString(),
      slot_end_time: end.toISOString(),
      duration_minutes: mins,
      job_id: row.job_id,
      job_table_name: "production_jobs",
      stage_instance_id: row.stage_instance_id,
      is_completed: false,
    });

    // Update both machine and job tails
    tails.set(row.production_stage_id, end);
    jobTails.set(row.job_id, end);

    // write back into JSI (UPDATE ONLY)
    await updateJSI(sb, row.stage_instance_id, mins, start.toISOString(), end.toISOString());
    jsiUpdates += 1;
  }

  // write slots in one batch
  await writeSlots(sb, slotsToWrite);

  return { slots: slotsToWrite.length, jsis: jsiUpdates };
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return json(200, { ok: true });
    }

    const body = (await req.json().catch(() => ({}))) as ScheduleRequest;

    // Basic validation/log
    const requestInfo = {
      commit: !!body.commit,
      proposed: !!body.proposed,
      onlyIfUnset: !!body.onlyIfUnset,
      nuclear: !!body.nuclear,
      wipeAll: !!body.wipeAll,
      startFrom: body.startFrom ?? null,
      onlyJobIds: Array.isArray(body.onlyJobIds) ? body.onlyJobIds.length : 0,
    };

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      global: { headers: { "x-client-info": "scheduler-run" } },
    });

    // Do the work
    const { slots, jsis } = await schedule(sb, body ?? {});
    return json(200, {
      ok: true,
      request: requestInfo,
      wrote_slots: slots,
      updated_jsi: jsis,
    });
  } catch (e: any) {
    console.error("scheduler-run fatal:", e);
    const code = e?.code ?? e?.status ?? "500";
    const msg = e?.message ?? String(e);
    return json(500, { ok: false, code, message: msg });
  }
});
