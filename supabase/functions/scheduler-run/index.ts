// v6.5
// deno-lint-ignore-file no-explicit-any
/**
 * Supabase Edge Function: scheduler-run
 *
 * Tables used (write paths only):
 *   - stage_time_slots(
 *       id uuid, production_stage_id uuid, date date, slot_start_time timestamptz,
 *       slot_end_time timestamptz, duration_minutes int, job_id uuid,
 *       job_table_name text='production_jobs', stage_instance_id uuid, is_completed bool
 *     )
 *   - job_stage_instances (UPDATE ONLY):
 *       set scheduled_minutes, scheduled_start_at, scheduled_end_at (never INSERT or change status)
 *
 * Shift calendar:
 *   - shift_schedules(day_of_week int, start_time time, end_time time, is_working_day bool)
 *   - public_holidays(date, is_active)
 *
 * API payloads:
 *   - Append (auto-approve hook): {commit:true, proposed:false, onlyIfUnset:true}
 *   - Reschedule all: {commit:true, proposed:false, onlyIfUnset:false, nuclear:true, wipeAll:true, startFrom:"YYYY-MM-DD"}
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

// ---------- Types ----------
type ScheduleRequest = {
  commit?: boolean;
  proposed?: boolean;      // currently unused, reserved
  onlyIfUnset?: boolean;   // skip JSIs that already have schedule filled
  nuclear?: boolean;       // alias of wipeAll
  wipeAll?: boolean;       // clear stage_time_slots before writing
  startFrom?: string;      // "YYYY-MM-DD" or ISO datetime
  onlyJobIds?: string[];   // schedule only these jobs
  pageSize?: number;       // override pagination
};

type StageRow = {
  stage_instance_id: string;
  production_stage_id: string;
  job_id: string;
  stage_order: number | null;
  scheduled_minutes: number | null;
  estimated_duration_minutes: number | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
};

type Slot = {
  production_stage_id: string;
  date: string;               // YYYY-MM-DD
  slot_start_time: string;    // ISO
  slot_end_time: string;      // ISO
  duration_minutes: number;
  job_id: string;
  job_table_name: "production_jobs";
  stage_instance_id: string;
  is_completed: boolean;
};

// ---------- Env ----------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY.");
  throw new Error("Missing required environment variables");
}

// ---------- CORS ----------
function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "*";
  const acrh =
    req.headers.get("Access-Control-Request-Headers") ??
    "authorization, apikey, x-client-info, content-type";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": acrh,
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
    "Content-Type": "application/json",
  };
}

function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: corsHeaders(req),
  });
}

async function withCors(req: Request, fn: () => Promise<Response>) {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }
    const res = await fn();
    // Ensure CORS headers are present even if handler set its own headers
    const merged = new Headers(res.headers);
    Object.entries(corsHeaders(req)).forEach(([k, v]) => merged.set(k, v as string));
    return new Response(res.body, { status: res.status, headers: merged });
  } catch (e: any) {
    console.error("scheduler-run fatal:", e);
    const code = e?.code ?? e?.status ?? "500";
    const message = e?.message ?? String(e);
    return json(req, 500, { ok: false, code, message });
  }
}

// ---------- Utilities ----------
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

// ---------- Shift Calendar ----------
type ShiftRule = { shift_start_time: string; shift_end_time: string; is_working_day: boolean };

async function getShiftRule(sb: SupabaseClient, dow: number): Promise<ShiftRule> {
  try {
    const { data, error } = await sb
      .from("shift_schedules")
      .select("shift_start_time,shift_end_time,is_working_day,day_of_week")
      .eq("day_of_week", dow)
      .maybeSingle();
    if (error) throw error;

    // Fallback: 08:00-17:00 (9h), working
    return data ?? { shift_start_time: "08:00:00", shift_end_time: "17:00:00", is_working_day: true };
  } catch (e) {
    console.error(`Error getting shift rule for day ${dow}:`, e);
    return { shift_start_time: "08:00:00", shift_end_time: "17:00:00", is_working_day: true };
  }
}

async function isHoliday(sb: SupabaseClient, dateUtc: string): Promise<boolean> {
  try {
    const { data, error } = await sb
      .from("public_holidays")
      .select("date,is_active")
      .eq("date", dateUtc)
      .eq("is_active", true);
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  } catch (e) {
    console.error(`Error checking holiday for ${dateUtc}:`, e);
    return false; // assume non-holiday on error
  }
}

async function nextWorkingStart(sb: SupabaseClient, fromTs: Date): Promise<Date> {
  let t = new Date(fromTs.getTime());
  for (let guard = 0; guard < 60; guard++) {
    const dow = t.getUTCDay();
    const rule = await getShiftRule(sb, dow);
    const day = asDateOnlyUTC(t);
    const holiday = await isHoliday(sb, day);

    if (rule.is_working_day && !holiday) {
      const start = new Date(`${day}T${rule.shift_start_time}Z`);
      const end = new Date(`${day}T${rule.shift_end_time}Z`);
      if (t <= start) return start;
      if (t > start && t < end) return t;
    }

    // Try next day at nominal 08:00; we'll realign with actual rule on next loop
    const next = new Date(t.getTime());
    next.setUTCDate(next.getUTCDate() + 1);
    t = new Date(`${asDateOnlyUTC(next)}T08:00:00Z`);
  }
  return t;
}

async function windowFor(sb: SupabaseClient, anyTs: Date): Promise<{ start: Date; end: Date }> {
  const dow = anyTs.getUTCDay();
  const rule = await getShiftRule(sb, dow);
  const day = asDateOnlyUTC(anyTs);
  const start = new Date(`${day}T${rule.shift_start_time}Z`);
  const end = new Date(`${day}T${rule.shift_end_time}Z`);
  const holiday = await isHoliday(sb, day);
  if (!rule.is_working_day || holiday) {
    const ns = await nextWorkingStart(sb, anyTs);
    return await windowFor(sb, ns);
  }
  return { start, end };
}

/**
 * Allocate one job-stage of "mins" duration starting no earlier than "candidate".
 * Keeps work inside shift windows. If mins exceed remaining window, splits into multiple slots.
 */
async function allocateSegments(
  sb: SupabaseClient,
  candidate: Date,
  mins: number,
): Promise<Array<{ start: Date; end: Date }>> {
  let need = Math.max(1, mins | 0);
  let cur = await nextWorkingStart(sb, candidate);
  const out: Array<{ start: Date; end: Date }> = [];

  while (need > 0) {
    const { start, end } = await windowFor(sb, cur);
    const winMins = Math.max(0, Math.floor((end.getTime() - Math.max(cur.getTime(), start.getTime())) / 60000));
    if (winMins <= 0) {
      cur = await nextWorkingStart(sb, addMinutes(end, 1)); // move to next window
      continue;
    }
    const take = Math.min(need, winMins);
    const segStart = cur < start ? start : cur;
    const segEnd = addMinutes(segStart, take);
    out.push({ start: segStart, end: segEnd });
    need -= take;
    cur = segEnd;
    if (need > 0) {
      // advance at least 1 minute into next window
      cur = await nextWorkingStart(sb, addMinutes(segEnd, 1));
    }
  }
  return out;
}

// ---------- Health Check ----------
async function healthCheck(sb: SupabaseClient): Promise<void> {
  try {
    // Test basic connectivity with a simple query
    const { error } = await sb.from("shift_schedules").select("day_of_week").limit(1);
    if (error) throw error;
    console.log("Database connectivity check passed");
  } catch (e) {
    console.error("Health check failed:", e);
    throw new Error(`Database connectivity failed: ${e.message}`);
  }
}
// ---------- Data access ----------
async function normalizeStart(sb: SupabaseClient, requested?: string): Promise<Date> {
  try {
    let base = requested ? new Date(requested) : new Date();
    if (requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)) {
      base = new Date(`${requested}T08:00:00Z`);
    }
    const now = new Date();
    if (base.getTime() < now.getTime()) {
      base = new Date(Math.ceil(now.getTime() / 60000) * 60000);
    }
    return await nextWorkingStart(sb, base);
  } catch (e) {
    console.error("Error normalizing start time:", e);
    throw e;
  }
}

function minutesFor(row: StageRow): number {
  const m = row.scheduled_minutes ?? row.estimated_duration_minutes ?? 1;
  return Math.max(1, m | 0);
}

async function wipeSlotsIfNeeded(sb: SupabaseClient, req: ScheduleRequest) {
  if (req.nuclear || req.wipeAll) {
    try {
      const { error } = await sb.from("stage_time_slots").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      console.log("Wiped existing stage time slots");
    } catch (e) {
      console.error("Error wiping slots:", e);
      throw e;
    }
  }
}

/** Last booked end for a stage, or base if none. */
async function queueTail(sb: SupabaseClient, stageId: string, base: Date): Promise<Date> {
  const { data, error } = await sb
    .from("stage_time_slots")
    .select("slot_end_time")
    .eq("production_stage_id", stageId)
    .order("slot_end_time", { ascending: false })
    .limit(1);
  if (error) throw error;
  const last = data?.[0]?.slot_end_time ? new Date(data[0].slot_end_time) : null;
  const seed = last && last > base ? last : base;
  return await nextWorkingStart(sb, seed);
}

/**
 * Pre-populate job completion times from existing scheduled stages.
 * This ensures cross-chunk continuity when jobs span multiple processing chunks.
 */
async function initializeJobCompletionTimes(
  sb: SupabaseClient,
  req: ScheduleRequest,
  baseStart: Date
): Promise<Map<string, Date>> {
  const jobCompletionTimes = new Map<string, Date>();
  
  try {
    // Build query to get existing scheduled stages
    let query = sb
      .from("stage_time_slots")
      .select(`
        job_id,
        slot_end_time,
        production_stage_id
      `)
      .order("job_id")
      .order("slot_end_time", { ascending: false });
    
    // Filter by job IDs if specified
    if (req.onlyJobIds && req.onlyJobIds.length > 0) {
      query = query.in("job_id", req.onlyJobIds);
    }
    
    const { data: existingSlots, error } = await query;
    if (error) throw error;
    
    // Group by job_id and find the latest end time for each job
    const jobLatestEndTimes = new Map<string, Date>();
    
    for (const slot of existingSlots || []) {
      const endTime = new Date(slot.slot_end_time);
      const currentLatest = jobLatestEndTimes.get(slot.job_id);
      
      if (!currentLatest || endTime > currentLatest) {
        jobLatestEndTimes.set(slot.job_id, endTime);
      }
    }
    
    // Initialize job completion times with existing scheduled end times
    for (const [jobId, latestEnd] of jobLatestEndTimes) {
      // Use the later of the existing end time or base start
      const completionTime = latestEnd > baseStart ? latestEnd : baseStart;
      jobCompletionTimes.set(jobId, completionTime);
      console.log(`Pre-populated job ${jobId} completion time: ${completionTime.toISOString()}`);
    }
    
    console.log(`Initialized job completion times for ${jobCompletionTimes.size} jobs with existing schedules`);
    
  } catch (e) {
    console.error("Error initializing job completion times:", e);
    // Continue with empty map if initialization fails
  }
  
  return jobCompletionTimes;
}

/**
 * Paged read of JSI rows ordered by (job_id, stage_order).
 * Emits complete job groups to keep memory small and to support cross-part rendezvous.
 */
async function* pagedJSIs(
  sb: SupabaseClient,
  req: ScheduleRequest,
  pageSize = 400,
): AsyncGenerator<Map<string, StageRow[]>> {
  let offset = 0;
  let carry: StageRow[] = [];
  for (;;) {
    let q = sb.from("job_stage_instances")
      .select(`
        stage_instance_id:id,
        production_stage_id,
        job_id,
        stage_order,
        scheduled_minutes,
        estimated_duration_minutes,
        scheduled_start_at,
        scheduled_end_at,
        status
      `)
      .order("job_id", { ascending: true })
      .order("stage_order", { ascending: true, nullsFirst: false })
      .range(offset, offset + pageSize - 1);

    if (req.onlyJobIds && req.onlyJobIds.length > 0) {
      q = q.in("job_id", req.onlyJobIds);
    }

    const { data, error } = await q;
    if (error) throw error;

    const rows: StageRow[] = (data ?? []).filter((r: any) => {
      if (r.status && String(r.status).toLowerCase() === "completed") return false;
      if (req.onlyIfUnset && (r.scheduled_start_at || r.scheduled_end_at)) return false;
      return true;
    });

    if ((rows?.length ?? 0) === 0) {
      // flush carry if any
      if (carry.length > 0) {
        const map = new Map<string, StageRow[]>();
        carry.forEach(r => {
          if (!map.has(r.job_id)) map.set(r.job_id, []);
          map.get(r.job_id)!.push(r);
        });
        yield map;
      }
      return;
    }

    // combine with carry
    const combined = carry.concat(rows);
    // split into job groups, but keep the last job as new carry (it may be incomplete)
    const groups = new Map<string, StageRow[]>();
    let lastJobId = combined.length ? combined[combined.length - 1].job_id : "";
    carry = [];
    for (const r of combined) {
      if (r.job_id === lastJobId) {
        carry.push(r);
        continue;
      }
      if (!groups.has(r.job_id)) groups.set(r.job_id, []);
      groups.get(r.job_id)!.push(r);
    }
    if (groups.size > 0) yield groups;
    offset += pageSize;
  }
}

// ---------- Writers ----------
async function writeSlots(sb: SupabaseClient, slots: Slot[]) {
  if (slots.length === 0) return;
  const { error } = await sb.from("stage_time_slots").insert(slots);
  if (error) throw error;
}

async function updateJSI(
  sb: SupabaseClient,
  jsiId: string,
  mins: number,
  startIso: string,
  endIso: string,
) {
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

// ---------- Core scheduling ----------
async function schedule(
  sb: SupabaseClient,
  req: ScheduleRequest,
): Promise<{ wroteSlots: number; updatedJSI: number; dryRun: boolean }> {
  const baseStart = await normalizeStart(sb, req.startFrom);
  await wipeSlotsIfNeeded(sb, req);

  const tails = new Map<string, Date>(); // per-stage machine tail
  
  // Pre-populate job completion times from existing scheduled stages
  // This ensures cross-chunk continuity when jobs span multiple processing chunks
  const jobCompletionTimes = await initializeJobCompletionTimes(sb, req, baseStart);
  
  let wroteSlots = 0;
  let updatedJSI = 0;

  const commit = !!req.commit;

  for await (const jobChunk of pagedJSIs(sb, req, req.pageSize ?? 400)) {
    // Each chunk is a Map<job_id, StageRow[]>, complete for those jobs
    for (const [jobId, rows] of jobChunk) {
      // SEQUENTIAL JOB PROCESSING: Sort stages by stage_order and process them one by one
      // This ensures strict precedence within each job
      const sortedStages = [...rows].sort((a, b) => {
        const aOrder = a.stage_order ?? 999999;
        const bOrder = b.stage_order ?? 999999;
        return aOrder - bOrder;
      });

      // Initialize job completion time if not exists (for jobs without existing schedules)
      if (!jobCompletionTimes.has(jobId)) {
        jobCompletionTimes.set(jobId, new Date(baseStart.getTime()));
        console.log(`Initializing new job ${jobId} completion time: ${baseStart.toISOString()}`);
      }

      console.log(`Processing job ${jobId} with ${sortedStages.length} stages sequentially`);

      // Process each stage in sequence within this job
      for (const r of sortedStages) {
          const mins = minutesFor(r);

          // ensure stage tail exists
          if (!tails.has(r.production_stage_id)) {
            const t = await queueTail(sb, r.production_stage_id, baseStart);
            tails.set(r.production_stage_id, t);
          }
          const stageTail = tails.get(r.production_stage_id)!;

          // Get job precedence time - this stage can't start until all previous stages of this job finish
          const jobPrecedenceTime = jobCompletionTimes.get(jobId) || new Date(baseStart.getTime());

          // Start no earlier than machine availability, job precedence, AND any cross-job dependencies
          let candidate = new Date(Math.max(stageTail.getTime(), jobPrecedenceTime.getTime()));

          console.log(`Scheduling job ${jobId} stage ${r.production_stage_id} order ${r.stage_order}: 
            stageTail=${stageTail.toISOString()}, 
            jobPrecedence=${jobPrecedenceTime.toISOString()}, 
            candidate=${candidate.toISOString()}`);

          // Allocate within shifts (may split across days)
          const segments = await allocateSegments(sb, candidate, mins);

          const segStart = segments[0].start;
          const segEnd = segments[segments.length - 1].end;

          // Create slots
          const slots: Slot[] = segments.map(seg => ({
            production_stage_id: r.production_stage_id,
            date: asDateOnlyUTC(seg.start),
            slot_start_time: seg.start.toISOString(),
            slot_end_time: seg.end.toISOString(),
            duration_minutes: Math.max(1, Math.round((seg.end.getTime() - seg.start.getTime()) / 60000)),
            job_id: r.job_id,
            job_table_name: "production_jobs",
            stage_instance_id: r.stage_instance_id,
            is_completed: false,
          }));

          if (commit) {
            await writeSlots(sb, slots);
            await updateJSI(sb, r.stage_instance_id, mins, segStart.toISOString(), segEnd.toISOString());
          }

          wroteSlots += slots.length;
          updatedJSI += 1;

          // advance machine tail to the end of this work
          tails.set(r.production_stage_id, segEnd);

          // Update job completion time - since we're processing sequentially, 
          // this stage's end time becomes the new job completion time
          jobCompletionTimes.set(jobId, segEnd);
          console.log(`Updated job ${jobId} completion time to: ${segEnd.toISOString()} (stage ${r.stage_order})`);
        }
      }

      // (Optional) You could capture a job-level summary here if needed
      console.debug(`Scheduled job ${jobId}`);
    }
  }

  return { wroteSlots, updatedJSI, dryRun: !commit };
}

// ---------- HTTP Handler ----------
serve((req) =>
  withCors(req, async () => {
    // Add timeout for long-running operations
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout after 5 minutes")), 5 * 60 * 1000);
    });

    const schedulerPromise = (async () => {
      if (req.method !== "POST") {
        if (new URL(req.url).searchParams.get("ping") === "1") {
          return json(req, 200, { ok: true, pong: true, now: new Date().toISOString() });
        }
        return json(req, 405, { ok: false, error: "Method Not Allowed" });
      }

      const body = (await req.json().catch(() => ({}))) as ScheduleRequest;

      const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
        global: { headers: { "x-client-info": "scheduler-run" } },
      });

      // Run health check first
      await healthCheck(sb);

      // Normalize boolean flags
      const normalized: ScheduleRequest = {
        commit: !!body.commit,
        proposed: !!body.proposed,
        onlyIfUnset: !!body.onlyIfUnset,
        nuclear: !!body.nuclear,
        wipeAll: !!body.wipeAll,
        startFrom: body.startFrom,
        onlyJobIds: Array.isArray(body.onlyJobIds) ? body.onlyJobIds : undefined,
        pageSize: (typeof body.pageSize === "number" && body.pageSize > 0) ? Math.min(1000, body.pageSize) : undefined,
      };

      console.log("Starting scheduler with request:", normalized);

      // Run scheduler
      const result = await schedule(sb, normalized);

      return json(req, 200, {
        ok: true,
        request: normalized,
        ...result,
      });
    })();

    return Promise.race([schedulerPromise, timeoutPromise]);
  })
);
