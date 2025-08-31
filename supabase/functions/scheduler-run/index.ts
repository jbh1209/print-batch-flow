// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

/**
 * Request payloads
 * - Append (auto-approve hook): {commit:true, proposed:false, onlyIfUnset:true}
 * - Reschedule all: {commit:true, proposed:false, onlyIfUnset:false, nuclear:true, wipeAll:true, startFrom:"YYYY-MM-DD"}
 */
type ScheduleRequest = {
  commit?: boolean;
  proposed?: boolean;
  onlyIfUnset?: boolean;
  nuclear?: boolean;
  wipeAll?: boolean;
  startFrom?: string;     // YYYY-MM-DD or ISO datetime
  onlyJobIds?: string[];  // schedule a subset of jobs
};

type StageRow = {
  stage_instance_id: string;
  production_stage_id: string;
  job_id: string;
  wo_no: string | null; // for logging/debug
  stage_order: number | null;
  scheduled_minutes: number | null;            // preferred duration
  estimated_duration_minutes: number | null;   // fallback duration
};

type Slot = {
  id?: string;
  production_stage_id: string;
  date: string;               // YYYY-MM-DD (UTC)
  slot_start_time: string;    // ISO (UTC)
  slot_end_time: string;      // ISO (UTC)
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
      "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    },
  });
}

function clampToMinuteUp(d: Date) {
  return new Date(Math.ceil(d.getTime() / 60_000) * 60_000);
}

function asDateOnlyUTC(d: Date): string {
  // YYYY-MM-DD (UTC)
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addMinutes(d: Date, m: number) {
  return new Date(d.getTime() + m * 60_000);
}

async function normalizeStart(sb: SupabaseClient, requested?: string): Promise<Date> {
  // Base seed: startFrom (date -> 08:00Z same day) or now
  let base = new Date();
  if (requested) {
    // If YYYY-MM-DD, anchor at 08:00Z; if full ISO, just parse it.
    if (/^\d{4}-\d{2}-\d{2}$/.test(requested)) {
      base = new Date(`${requested}T08:00:00Z`);
    } else {
      base = new Date(requested);
    }
  }
  // Never in the past
  const now = new Date();
  if (base.getTime() < now.getTime()) base = clampToMinuteUp(now);

  // Snap into next working window
  return await nextWorkingStart(sb, base);
}

async function nextWorkingStart(sb: SupabaseClient, fromTs: Date): Promise<Date> {
  // Schema:
  //   shift_schedules(day_of_week int, start_time time, end_time time, is_working_day bool)
  //   public_holidays(date date, is_active bool)
  let ts = new Date(fromTs.getTime());

  for (let guard = 0; guard < 60; guard++) {
    const dow = ts.getUTCDay(); // 0..6 (Sun..Sat)
    const { data: rule, error: ruleErr } = await sb
      .from("shift_schedules")
      .select("day_of_week,start_time,end_time,is_working_day")
      .eq("day_of_week", dow)
      .maybeSingle();
    if (ruleErr) throw ruleErr;

    // Holiday?
    const { data: holi, error: holiErr } = await sb
      .from("public_holidays")
      .select("date,is_active")
      .eq("date", asDateOnlyUTC(ts))
      .eq("is_active", true)
      .maybeSingle();
    if (holiErr) throw holiErr;

    const working = rule?.is_working_day && !holi;
    if (!working) {
      // Move to next day 00:00 UTC
      const nextDay = new Date(Date.UTC(ts.getUTCFullYear(), ts.getUTCMonth(), ts.getUTCDate() + 1, 0, 0, 0));
      ts = nextDay;
      continue;
    }

    // Build day window
    const dayStart = new Date(`${asDateOnlyUTC(ts)}T${rule!.start_time}Z`);
    const dayEnd = new Date(`${asDateOnlyUTC(ts)}T${rule!.end_time}Z`);

    if (ts <= dayStart) return dayStart;               // before window -> start of window
    if (ts > dayEnd) {                                 // after window -> try next day
      const nextDay = new Date(Date.UTC(ts.getUTCFullYear(), ts.getUTCMonth(), ts.getUTCDate() + 1, 0, 0, 0));
      ts = nextDay;
      continue;
    }
    // Inside working window -> return original ts (never earlier than input)
    return clampToMinuteUp(ts);
  }

  // Safety
  return clampToMinuteUp(fromTs);
}

function minutesFor(row: StageRow): number {
  const m = row.scheduled_minutes ?? row.estimated_duration_minutes ?? 1;
  return Math.max(1, m | 0);
}

async function wipeSlotsIfNeeded(sb: SupabaseClient, req: ScheduleRequest) {
  if (req.nuclear || req.wipeAll) {
    // Simple full wipe without touching the sentinel
    const { error } = await sb
      .from("stage_time_slots")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw error;
  }
}

async function queueTail(sb: SupabaseClient, stageId: string, base: Date): Promise<Date> {
  // Last end for the machine, but never earlier than base; then snap to next window
  const { data, error } = await sb
    .from("stage_time_slots")
    .select("slot_end_time")
    .eq("production_stage_id", stageId)
    .order("slot_end_time", { ascending: false })
    .limit(1);
  if (error) throw error;

  const last = (data?.length ? new Date(data[0].slot_end_time) : null);
  const seed = last && last > base ? last : base;
  return await nextWorkingStart(sb, seed);
}

async function selectJobStageRows(sb: SupabaseClient, req: ScheduleRequest, offset: number, limit: number) {
  // NOTE: UPDATE ONLY; we do not change status here.
  let q = sb
    .from("job_stage_instances")
    .select(`
      stage_instance_id:id,
      production_stage_id,
      job_id,
      wo_no:production_jobs(wo_no),
      stage_order,
      scheduled_minutes,
      estimated_duration_minutes
    `)
    .neq("status", "completed")
    .order("job_id", { ascending: true })
    .order("stage_order", { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (req.onlyJobIds?.length) {
    q = q.in("job_id", req.onlyJobIds);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data as StageRow[];
}

async function updateJSI(sb: SupabaseClient, jsiId: string, mins: number, startIso: string, endIso: string) {
  // UPDATE ONLY – never insert and never touch status
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

async function prefetchExistingSlots(sb: SupabaseClient, stageInstanceIds: string[]): Promise<Set<string>> {
  if (stageInstanceIds.length === 0) return new Set();
  const { data, error } = await sb
    .from("stage_time_slots")
    .select("stage_instance_id")
    .in("stage_instance_id", stageInstanceIds);
  if (error) throw error;
  return new Set((data ?? []).map((r: any) => r.stage_instance_id));
}

async function writeSlots(sb: SupabaseClient, rows: Slot[]) {
  if (!rows.length) return;
  const { error } = await sb.from("stage_time_slots").insert(rows);
  if (error) throw error;
}

type JobWave = {
  order: number;
  rows: StageRow[];
};

function groupByJobThenOrder(rows: StageRow[]): Map<string, JobWave[]> {
  const byJob = new Map<string, StageRow[]>();
  for (const r of rows) {
    if (!byJob.has(r.job_id)) byJob.set(r.job_id, []);
    byJob.get(r.job_id)!.push(r);
  }

  const out = new Map<string, JobWave[]>();
  for (const [jobId, arr] of byJob.entries()) {
    const byOrder = new Map<number, StageRow[]>();
    for (const r of arr) {
      const ord = (r.stage_order ?? 0);
      if (!byOrder.has(ord)) byOrder.set(ord, []);
      byOrder.get(ord)!.push(r);
    }
    const waves = [...byOrder.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([order, rows]) => ({ order, rows }));
    out.set(jobId, waves);
  }
  return out;
}

async function schedule(sb: SupabaseClient, req: ScheduleRequest): Promise<{ slots: number; jsis: number }> {
  const commit = req.commit !== false;               // default true (write)
  const onlyIfUnset = !!req.onlyIfUnset;             // default false
  const baseStart = await normalizeStart(sb, req.startFrom);
  await wipeSlotsIfNeeded(sb, req);

  const tails = new Map<string, Date>();             // per machine tail
  let totalSlots = 0;
  let totalJsiUpdates = 0;

  // Paged read to keep memory small
  const PAGE = 400;
  for (let offset = 0; ; offset += PAGE) {
    const rows = await selectJobStageRows(sb, req, offset, PAGE);
    if (!rows.length) break;

    // If onlyIfUnset, prefetch which stage instances already have slots
    const existing = onlyIfUnset
      ? await prefetchExistingSlots(sb, rows.map(r => r.stage_instance_id))
      : new Set<string>();

    // Group rows by job, then by stage_order (waves)
    const jobWaves = groupByJobThenOrder(rows);

    // We will collect inserts per page and flush once
    const slotsToInsert: Slot[] = [];

    for (const [jobId, waves] of jobWaves.entries()) {
      let barrier: Date = new Date(baseStart.getTime()); // max end of previous wave for this job

      for (const wave of waves) {
        // Schedule every row in this wave, but clamp to >= barrier
        const scheduledEndsThisWave: Date[] = [];

        for (const row of wave.rows) {
          if (onlyIfUnset && existing.has(row.stage_instance_id)) {
            continue; // leave already-scheduled instance alone
          }

          const mins = minutesFor(row);

          // init machine tail if needed
          if (!tails.has(row.production_stage_id)) {
            tails.set(row.production_stage_id, await queueTail(sb, row.production_stage_id, baseStart));
          }

          // candidate start = max(machineTail, barrier)
          const machineTail = tails.get(row.production_stage_id)!;
          const candidate = (machineTail > barrier) ? machineTail : barrier;

          // snap to working windows
          const start = await nextWorkingStart(sb, candidate);
          const end = addMinutes(start, mins);

          // advance machine tail
          tails.set(row.production_stage_id, new Date
