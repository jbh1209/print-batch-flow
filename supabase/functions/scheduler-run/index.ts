// supabase/functions/scheduler-run/index.ts
// Edge function: schedule appendix & rebuild with precedence + shift calendar.
// Deno + supabase-js. No external deps.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ---------- Types ----------
type RequestBody = {
  commit?: boolean;
  proposed?: boolean;
  onlyIfUnset?: boolean;
  nuclear?: boolean;
  wipeAll?: boolean;
  startFrom?: string | null;
  onlyJobIds?: string[] | null;
};

type ShiftRow = {
  day_of_week: number;             // 0-6 (Sun..Sat)
  is_working_day: boolean;
  start_time: string;              // '08:00:00'
  end_time: string;                // '16:30:00'
};

type HolidayRow = { holiday_date: string; is_active: boolean };

type StageInstance = {
  jsi_id: string;
  job_id: string;
  wo_no: string;
  production_stage_id: string;
  stage_order: number;
  status: string | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  scheduled_minutes: number | null;
  estimated_duration_minutes: number | null;
  setup_time_minutes: number | null;
};

type QueueTail = Record<string, string | null>; // production_stage_id -> last slot_end_time (ISO)

// ---------- Utility: environment / client ----------
function getClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ---------- Utility: dates ----------
function iso(d: Date): string { return d.toISOString(); }
function fromISO(s: string): Date { return new Date(s); }

// All calendar math uses UTC (your DB stores timestamptz; UI already deals with zones).

function parseHHMM(ss: string): { h: number; m: number } {
  const [h, m] = ss.slice(0,5).split(":").map((n) => parseInt(n, 10));
  return { h, m };
}

function setTimeUTC(d: Date, hhmm: string): Date {
  const { h, m } = parseHHMM(hhmm);
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m, 0, 0));
  return x;
}

function addMinutesUTC(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

function ymd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------- Calendar helpers ----------
type Calendar = {
  byDow: Record<number, { working: boolean; start: string; end: string }>;
  holidays: Set<string>; // YYYY-MM-DD
};

function buildCalendar(shiftRows: ShiftRow[], holidayRows: HolidayRow[]): Calendar {
  const byDow: Calendar["byDow"] = {};
  for (const r of shiftRows) {
    byDow[r.day_of_week] = {
      working: !!r.is_working_day,
      start: r.start_time,
      end: r.end_time,
    };
  }
  const holidays = new Set<string>();
  for (const h of holidayRows) {
    if (h.is_active) holidays.add(h.holiday_date);
  }
  return { byDow, holidays };
}

function isWorkingDay(cal: Calendar, d: Date): boolean {
  const dow = d.getUTCDay();
  const row = cal.byDow[dow];
  return !!row?.working && !cal.holidays.has(ymd(d));
}

function shiftStart(cal: Calendar, d: Date): Date {
  const row = cal.byDow[d.getUTCDay()];
  if (!row) return setTimeUTC(d, "08:00:00");
  return setTimeUTC(d, row.start);
}

function shiftEnd(cal: Calendar, d: Date): Date {
  const row = cal.byDow[d.getUTCDay()];
  if (!row) return setTimeUTC(d, "16:30:00");
  return setTimeUTC(d, row.end);
}

function nextWorkingStart(cal: Calendar, at: Date): Date {
  // If today is a working day and within shift -> clamp to [start,end] start.
  // If before start -> start of today. If after end -> start next working day.
  let d = new Date(at);
  for (let guard = 0; guard < 400; guard++) {
    if (!isWorkingDay(cal, d)) {
      // bump to next day 00:00
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0));
      continue;
    }
    const s = shiftStart(cal, d);
    const e = shiftEnd(cal, d);
    if (d < s) return s;
    if (d >= e) {
      // move to next day
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0));
      continue;
    }
    // inside shift window; return current time (already within).
    return d;
  }
  return shiftStart(cal, d);
}

// Add working minutes across days; returns end time.
function addWorkingMinutes(cal: Calendar, start: Date, minutes: number): Date {
  let cur = new Date(start);
  let left = Math.max(0, Math.floor(minutes));
  for (let guard = 0; guard < 10000 && left > 0; guard++) {
    cur = nextWorkingStart(cal, cur);
    const e = shiftEnd(cal, cur);
    const room = Math.max(0, Math.floor((e.getTime() - cur.getTime()) / 60000));
    if (room === 0) {
      cur = addMinutesUTC(e, 1); // nudge
      continue;
    }
    const use = Math.min(room, left);
    cur = addMinutesUTC(cur, use);
    left -= use;
  }
  return cur;
}

// ---------- DB helpers ----------
async function fetchCalendar(sb: SupabaseClient): Promise<Calendar> {
  const shifts = await sb.from("shift_schedules")
    .select("day_of_week,is_working_day,start_time,end_time");
  if (shifts.error) throw shifts.error;

  const hols = await sb.from("public_holidays")
    .select("holiday_date:is_active_date, is_active"); // holiday_date column may be named `date` in your DB
  // Try fallback names:
  let holidays: HolidayRow[] = [];
  if (hols.error) {
    const alt = await sb.from("public_holidays").select("date as holiday_date, is_active");
    if (alt.error) throw alt.error;
    holidays = alt.data as any;
  } else {
    holidays = (shifts.data, hols.data) as any;
  }

  // Re-query holidays properly:
  const hol = await sb.from("public_holidays").select("date, is_active");
  if (hol.error) throw hol.error;

  const shiftRows = (shifts.data ?? []) as ShiftRow[];
  const holidayRows = (hol.data ?? []).map((r: any) => ({
    holiday_date: r.date as string,
    is_active: !!r.is_active,
  })) as HolidayRow[];

  return buildCalendar(shiftRows, holidayRows);
}

async function wipeSlots(
  sb: SupabaseClient,
  opts: { onlyJobIds?: string[] | null; wipeAll?: boolean }
) {
  if (opts.wipeAll) {
    const del = await sb.from("stage_time_slots").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (del.error) throw del.error;
    return;
  }
  if (opts.onlyJobIds && opts.onlyJobIds.length > 0) {
    // delete per job via join on jsi
    const { data: jsi, error } = await sb
      .from("job_stage_instances")
      .select("id")
      .in("job_id", opts.onlyJobIds);
    if (error) throw error;
    const ids = (jsi ?? []).map((r: any) => r.id);
    if (ids.length > 0) {
      const del = await sb.from("stage_time_slots").delete().in("stage_instance_id", ids);
      if (del.error) throw del.error;
    }
  }
}

async function queueTailsFor(
  sb: SupabaseClient,
  stageIds: string[]
): Promise<QueueTail> {
  if (stageIds.length === 0) return {};
  const { data, error } = await sb
    .from("stage_time_slots")
    .select("production_stage_id, slot_end_time")
    .in("production_stage_id", stageIds)
    .order("slot_end_time", { ascending: false });
  if (error) throw error;

  // First row per stage is tail
  const tails: QueueTail = {};
  for (const r of data ?? []) {
    if (!tails[r.production_stage_id]) tails[r.production_stage_id] = r.slot_end_time;
  }
  return tails;
}

async function fetchStagesToSchedule(
  sb: SupabaseClient,
  onlyJobIds: string[] | null,
  onlyIfUnset: boolean
): Promise<StageInstance[]> {
  // Pull all *non-completed* stage instances for the jobs of interest.
  // If onlyIfUnset=true, prefer those without scheduled_start_at.
  let base = sb.from("job_stage_instances")
    .select(`
      jsi_id:id,
      job_id,
      production_stage_id,
      stage_order,
      status,
      scheduled_start_at,
      scheduled_end_at,
      scheduled_minutes,
      estimated_duration_minutes,
      setup_time_minutes,
      production_jobs!inner(wo_no),
      production_stages!inner(name)
    `)
    .order("job_id", { ascending: true })
    .order("stage_order", { ascending: true });

  if (onlyJobIds && onlyJobIds.length > 0) base = base.in("job_id", onlyJobIds);

  const { data, error } = await base.neq("status", "completed");
  if (error) throw error;

  const rows = (data ?? []).map((r: any) => ({
    jsi_id: r.jsi_id,
    job_id: r.job_id,
    wo_no: r.production_jobs.wo_no,
    production_stage_id: r.production_stage_id,
    stage_order: r.stage_order,
    status: r.status,
    scheduled_start_at: r.scheduled_start_at,
    scheduled_end_at: r.scheduled_end_at,
    scheduled_minutes: r.scheduled_minutes,
    estimated_duration_minutes: r.estimated_duration_minutes,
    setup_time_minutes: r.setup_time_minutes,
  })) as StageInstance[];

  if (onlyIfUnset) {
    return rows.filter(r => !r.scheduled_start_at);
  }
  return rows;
}

// ---------- Core scheduler ----------
async function executeScheduler(
  sb: SupabaseClient,
  request: Required<RequestBody> & { baseStart: string }
): Promise<{ jobs_considered: number; scheduled: number; applied: { updated: number } }> {

  // 1) Calendar
  const cal = await fetchCalendar(sb);
  let baseStart = fromISO(request.baseStart);
  baseStart = nextWorkingStart(cal, baseStart);

  // 2) Which stages?
  const stages = await fetchStagesToSchedule(sb, request.onlyJobIds ?? null, !!request.onlyIfUnset);
  const uniqueStageIds = [...new Set(stages.map(s => s.production_stage_id))];

  // 3) For append: get current queue tails for those machines.
  let tails = await queueTailsFor(sb, uniqueStageIds);
  // Also ensure in-memory tails include baseStart fallback
  for (const sid of uniqueStageIds) {
    const t = tails[sid] ? fromISO(tails[sid] as string) : null;
    tails[sid] = iso(nextWorkingStart(cal, t ? t : baseStart));
  }

  // 4) Optional wipe if nuclear/wipeAll already requested (wrapper depends on us)
  if (request.nuclear || request.wipeAll) {
    await wipeSlots(sb, { onlyJobIds: request.onlyJobIds ?? null, wipeAll: !!request.wipeAll });
    // After wipe, tails vanish
    for (const sid of uniqueStageIds) tails[sid] = iso(baseStart);
  }

  // 5) Precedence tracking: per job last scheduled end
  const lastEndPerJob = new Map<string, Date>();

  // preload completed predecessors end times if present
  // (when rebuilding partially)
  const byJob = new Map<string, StageInstance[]>();
  for (const s of stages) {
    const arr = byJob.get(s.job_id) ?? [];
    arr.push(s);
    byJob.set(s.job_id, arr);
  }

  // 6) Placement loop
  let scheduled = 0;
  const updates: Array<{
    jsi_id: string; start: string; end: string; minutes: number;
    production_stage_id: string;
  }> = [];

  for (const [job_id, list] of byJob.entries()) {
    // ensure stage_order asc
    list.sort((a, b) => a.stage_order - b.stage_order);

    // seed lastEnd with known completed predecessor if exists
    let lastEnd = lastEndPerJob.get(job_id) ?? baseStart;

    for (const s of list) {
      // If onlyIfUnset and already scheduled, skip
      if (request.onlyIfUnset && s.scheduled_start_at) continue;

      // If some earlier stage is still pending/unscheduled in this very run,
      // lastEnd is updated below as we go.

      const minutes =
        (s.scheduled_minutes ?? 0) > 0
          ? (s.scheduled_minutes as number)
          : Math.max(
              1,
              Math.floor((s.estimated_duration_minutes ?? 0) + (s.setup_time_minutes ?? 0))
            );

      // Start anchor = max(prev stage end, machine tail, baseStart)
      const prevEnd = lastEnd;
      const tailStr = tails[s.production_stage_id] as string | null;
      const tail = tailStr ? fromISO(tailStr) : baseStart;
      let start = new Date(Math.max(prevEnd.getTime(), tail.getTime(), baseStart.getTime()));
      start = nextWorkingStart(cal, start);
      const end = addWorkingMinutes(cal, start, minutes);

      // Record for batch write
      updates.push({
        jsi_id: s.jsi_id,
        start: iso(start),
        end: iso(end),
        minutes,
        production_stage_id: s.production_stage_id,
      });
      scheduled++;

      // advance per-job and per-machine tails
      lastEnd = end;
      tails[s.production_stage_id] = iso(end);
    }
    lastEndPerJob.set(job_id, lastEnd);
  }

  // 7) Apply (write)
  let updatedRows = 0;

  if (request.commit && updates.length > 0) {
    // Delete existing slots for the same stage instances when not onlyIfUnset
    if (!request.onlyIfUnset) {
      const ids = updates.map(u => u.jsi_id);
      // delete existing slots for those instances (safe even if none)
      const del = await sb.from("stage_time_slots").delete().in("stage_instance_id", ids);
      if (del.error) throw del.error;
    }

    // Insert new slots
    // one row per stage instance (contiguous block)
    const insPayload = updates.map(u => ({
      production_stage_id: u.production_stage_id,
      stage_instance_id: u.jsi_id,
      slot_start_time: u.start,
      slot_end_time: u.end,
      // Optional: if you have a "date" column, you may want to set it here to ::date of start
    }));
    const ins = await sb.from("stage_time_slots").insert(insPayload);
    if (ins.error) throw ins.error;

    // Update JSI scheduled_* and status->queued (if not completed)
    for (const u of updates) {
      const up = await sb.from("job_stage_instances").update({
        scheduled_start_at: u.start,
        scheduled_end_at: u.end,
        scheduled_minutes: u.minutes,
        status: "queued",
      }).eq("id", u.jsi_id);
      if (up.error) throw up.error;
      updatedRows += (up.count ?? 0) || 1;
    }
  }

  const jobs_considered = byJob.size;
  return { jobs_considered, scheduled, applied: { updated: updatedRows } };
}

// ---------- HTTP handler (wrapper/orchestrator) ----------
serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    if (req.method !== "POST") {
      return json({ ok: false, error: "Use POST." }, 405);
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const commit = !!body.commit;
    const proposed = !!body.proposed;
    const onlyIfUnset = !!body.onlyIfUnset;
    const nuclear = !!body.nuclear;
    const wipeAll = !!body.wipeAll;
    const onlyJobIds = (body.onlyJobIds ?? [])?.filter(Boolean) ?? [];

    // Base anchor from payload OR "now"
    const now = new Date();
    let baseAnchor = body.startFrom
      ? new Date(`${body.startFrom}T00:00:00Z`)
      : now;

    const sb = getClient();

    // Build calendar to normalize baseStart (skip weekends/holidays & shift bounds)
    const cal = await fetchCalendar(sb);
    const normalizedBase = nextWorkingStart(cal, baseAnchor);

    // Execute scheduler
    const result = await executeScheduler(sb, {
      commit,
      proposed,
      onlyIfUnset,
      nuclear,
      wipeAll,
      startFrom: body.startFrom ?? null,
      onlyJobIds,
      baseStart: iso(normalizedBase),
    });

    return json({
      ok: true,
      message: "ok",
      baseStart: iso(normalizedBase),
      notes: {
        commit, proposed, onlyIfUnset, nuclear, wipeAll,
        onlyJobIdsCount: onlyJobIds.length,
      },
      ...result,
    });

  } catch (err: any) {
    return json({ ok: false, error: String(err?.message ?? err) }, 500);
  }
}, { onListen: () => {} });

// ---------- helpers ----------
function json(payload: any, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}
