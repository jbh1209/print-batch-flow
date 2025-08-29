// supabase/functions/scheduler-run/index.ts
//
// Production scheduler with full CORS and a minute-slot engine that respects:
// - per-stage queue tail (append),
// - per-job dependency (previous stages must end first),
// - shift calendar (Mon–Fri 08:00–16:30 by default),
// - public holidays,
// - nuclear rebuild (wipe + rebuild).
//
// IMPORTANT: This file is self-contained. Paste it as-is. No find/replace needed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

type SchedulerRequest = {
  commit?: boolean;
  proposed?: boolean;
  onlyIfUnset?: boolean; // append-only use-case
  nuclear?: boolean;
  wipeAll?: boolean;
  startFrom?: string | null; // ISO date/time or date; normalized to next working start
  onlyJobIds?: string[] | null; // restrict scope
};

type ResultSummary = {
  ok: true;
  jobs_considered: number;
  stages_considered: number;
  minutes_scheduled: number;
  slots_inserted: number;
  stage_updates: number;
  message: string;
};

type ShiftRow = {
  day_of_week: number; // 0..6
  is_working_day: boolean;
  start_time: string;  // "08:00:00" or time with/without tz
  end_time: string;    // "16:30:00"
};

type HolidayRow = {
  date: string;      // "YYYY-MM-DD"
  is_active: boolean;
};

type StageInstance = {
  id: string;
  job_id: string;
  production_stage_id: string;
  stage_order: number | null;
  status: string | null;
  scheduled_minutes: number | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  est_minutes: number | null;   // optional in your schema; handled if present
  setup_minutes: number | null; // optional
};

function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(
  body: unknown,
  init: ResponseInit & { origin?: string | null } = {},
): Response {
  const origin = init.origin ?? null;
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
      ...corsHeaders(origin),
    },
  });
}

// ------- Utilities: dates / shifts / working time --------------------------------

const TZ = "UTC"; // all scheduling is done in UTC to match your DB timestamps

function toDate(input: string | Date): Date {
  return input instanceof Date ? input : new Date(input);
}

function iso(dt: Date): string {
  return dt.toISOString().replace(/\.\d{3}Z$/, "Z");
}

// Merge a date with a "HH:MM:SS" time (both in UTC).
function atTime(date: Date, hhmmss: string): Date {
  const [h, m, s] = hhmmss.split(":").map((v) => parseInt(v, 10));
  const d = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    h || 0,
    m || 0,
    s || 0,
  ));
  return d;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60_000);
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function timeOnly(d: Date): string {
  return d.toISOString().slice(11, 19); // "HH:MM:SS"
}

type ShiftCalendar = {
  byDow: Map<number, { isWorking: boolean; start: string; end: string }>;
  holidays: Set<string>; // YYYY-MM-DD
};

function isHoliday(cal: ShiftCalendar, d: Date): boolean {
  return cal.holidays.has(dayKey(d));
}

function isWorkingDay(cal: ShiftCalendar, d: Date): boolean {
  const dow = d.getUTCDay();
  const row = cal.byDow.get(dow);
  return !!row?.isWorking && !isHoliday(cal, d);
}

function getDayWindow(cal: ShiftCalendar, d: Date): { start: Date; end: Date } {
  const dow = d.getUTCDay();
  const row = cal.byDow.get(dow);
  const start = row ? atTime(d, row.start) : atTime(d, "08:00:00");
  const end = row ? atTime(d, row.end) : atTime(d, "16:30:00");
  return { start, end };
}

// Move dt to the next valid working start (respecting weekend/holiday + shift window).
function nextWorkingStart(cal: ShiftCalendar, dt: Date): Date {
  let cur = new Date(dt.getTime());
  for (let guard = 0; guard < 366; guard++) {
    if (!isWorkingDay(cal, cur)) {
      cur = atTime(addDays(cur, 1), cal.byDow.get(addDays(cur, 1).getUTCDay())?.start ?? "08:00:00");
      continue;
    }
    const { start, end } = getDayWindow(cal, cur);
    if (cur < start) return start;
    if (cur >= end) {
      // next day start
      const next = addDays(cur, 1);
      cur = atTime(next, cal.byDow.get(next.getUTCDay())?.start ?? "08:00:00");
      continue;
    }
    return cur; // inside working window already
  }
  return cur;
}

// Add exactly one working minute; if crossing window, jump to next working day's start.
function addOneWorkingMinute(cal: ShiftCalendar, dt: Date): Date {
  const { end } = getDayWindow(cal, dt);
  const next = addMinutes(dt, 1);
  if (next < end) return next;

  // jump to next working day start
  let cur = addDays(dt, 1);
  for (let guard = 0; guard < 366; guard++) {
    if (!isWorkingDay(cal, cur)) {
      cur = addDays(cur, 1);
      continue;
    }
    const { start } = getDayWindow(cal, cur);
    return start;
  }
  return next;
}

// ------- Supabase helpers ---------------------------------------------------------

function sbClient() {
  const url =
    Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    Deno.env.get("SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY in function env");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// fetch shift schedule + holidays and build calendar object
async function loadCalendar(sb: ReturnType<typeof sbClient>): Promise<ShiftCalendar> {
  const { data: shifts } = await sb
    .from("shift_schedules")
    .select("day_of_week, is_working_day, start_time, end_time")
    .order("day_of_week", { ascending: true });

  const byDow = new Map<number, { isWorking: boolean; start: string; end: string }>();
  if (shifts && shifts.length) {
    for (const r of shifts as ShiftRow[]) {
      byDow.set(r.day_of_week, {
        isWorking: !!r.is_working_day,
        start: (r.start_time || "08:00:00").slice(0, 8),
        end: (r.end_time || "16:30:00").slice(0, 8),
      });
    }
  } else {
    // sensible defaults Mon–Fri
    for (let dow = 0; dow < 7; dow++) {
      const isWorking = dow >= 1 && dow <= 5;
      byDow.set(dow, { isWorking, start: "08:00:00", end: "16:30:00" });
    }
  }

  const { data: hols } = await sb
    .from("public_holidays")
    .select("date, is_active")
    .eq("is_active", true);

  const holidays = new Set<string>();
  if (hols) {
    for (const h of hols as HolidayRow[]) {
      if (h.is_active && h.date) holidays.add(h.date);
    }
  }

  return { byDow, holidays };
}

// Max tail per production_stage_id (end of queue). If no slots yet, return null.
async function getStageTail(
  sb: ReturnType<typeof sbClient>,
  production_stage_id: string,
): Promise<Date | null> {
  const { data, error } = await sb
    .from("stage_time_slots")
    .select("slot_end_time")
    .eq("production_stage_id", production_stage_id)
    .order("slot_end_time", { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!data || !data.length) return null;
  return new Date(data[0].slot_end_time);
}

// Batch insert helper (chunked)
async function batchInsert<T>(
  sb: ReturnType<typeof sbClient>,
  table: string,
  rows: T[],
  chunk = 500,
): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await sb.from(table).insert(slice);
    if (error) throw error;
    inserted += slice.length;
  }
  return inserted;
}

// ------- Core scheduler -----------------------------------------------------------

async function executeScheduler(
  sb: ReturnType<typeof sbClient>,
  req: SchedulerRequest,
): Promise<ResultSummary> {
  // 1) Calendar
  const calendar = await loadCalendar(sb);

  // 2) Determine baseline start
  const now = new Date(); // UTC in Edge by default
  const requested = req.startFrom ? new Date(req.startFrom) : now;
  const baseStart = nextWorkingStart(calendar, requested);

  // 3) Nuclear wipe (optional)
  if (req.nuclear || req.wipeAll) {
    // wipe all stage_time_slots
    const { error: delErr } = await sb.from("stage_time_slots").delete().neq("production_stage_id", ""); // delete all
    if (delErr) throw delErr;

    // clear scheduling markers on all JSI (pending/queued only)
    const { error: updErr } = await sb
      .from("job_stage_instances")
      .update({
        scheduled_start_at: null,
        scheduled_end_at: null,
        // do NOT zero out your calculated minutes – leave scheduled_minutes as-is
      })
      .in("status", ["pending", "queued"]);
    if (updErr) throw updErr;
  }

  // 4) Which stage instances to consider?
  //    - If onlyIfUnset + onlyJobIds: only the FIRST pending stage for each job (append path).
  //    - Else: all pending/queued stage instances (optionally limited by onlyJobIds).
  let jsi: StageInstance[] = [];

  if (req.onlyIfUnset && req.onlyJobIds?.length) {
    // First pending per job
    const { data, error } = await sb
      .from("job_stage_instances")
      .select("id, job_id, production_stage_id, stage_order, status, scheduled_minutes, scheduled_start_at, scheduled_end_at, est_minutes, setup_minutes")
      .in("job_id", req.onlyJobIds)
      .in("status", ["pending", "queued"]) // treat queued as schedulable
      .order("stage_order", { ascending: true });

    if (error) throw error;
    const byJob = new Map<string, StageInstance[]>();
    for (const row of (data || []) as StageInstance[]) {
      const list = byJob.get(row.job_id) || [];
      list.push(row);
      byJob.set(row.job_id, list);
    }
    for (const [_, list] of byJob.entries()) {
      if (list.length) jsi.push(list[0]);
    }
  } else {
    const q = sb
      .from("job_stage_instances")
      .select("id, job_id, production_stage_id, stage_order, status, scheduled_minutes, scheduled_start_at, scheduled_end_at, est_minutes, setup_minutes")
      .in("status", ["pending", "queued"])
      .order("job_id", { ascending: true })
      .order("stage_order", { ascending: true });

    if (req.onlyJobIds?.length) q.in("job_id", req.onlyJobIds);

    const { data, error } = await q;
    if (error) throw error;
    jsi = (data || []) as StageInstance[];
  }

  // 5) Prepare stage queue tails (cache) and per-job prev_end
  const stageTail = new Map<string, Date>(); // production_stage_id -> tail end
  const jobPrevEnd = new Map<string, Date>(); // job_id -> latest end among earlier stages

  // For rescheduling many stages, we’ll build the tails lazily.
  async function getTail(pid: string): Promise<Date> {
    if (stageTail.has(pid)) return stageTail.get(pid)!;
    // If nuclear: start from baseStart; else: queue tail from DB or baseStart if empty
    const tail = (req.nuclear || req.wipeAll)
      ? baseStart
      : (await getStageTail(sb, pid)) ?? baseStart;
    stageTail.set(pid, tail);
    return tail;
  }

  // 6) Iterate stages and allocate minutes -> slots
  let slotsToInsert: {
    production_stage_id: string;
    stage_instance_id: string;
    slot_start_time: string;
    slot_end_time: string;
  }[] = [];

  let stages_considered = 0;
  let minutes_scheduled = 0;
  let stage_updates = 0;

  // Group by job, then process in stage_order so prev_end works naturally
  const byJob = new Map<string, StageInstance[]>();
  for (const s of jsi) {
    const list = byJob.get(s.job_id) || [];
    list.push(s);
    byJob.set(s.job_id, list);
  }
  for (const [jobId, list] of byJob.entries()) {
    list.sort((a, b) => (a.stage_order ?? 9999) - (b.stage_order ?? 9999));

    let prevEnd = jobPrevEnd.get(jobId) || baseStart;

    for (const s of list) {
      stages_considered++;

      // Determine minutes needed:
      // prefer est_minutes + setup_minutes; fall back to scheduled_minutes; skip if <=0
      const est =
        (Number(s.est_minutes ?? 0) || 0) + (Number(s.setup_minutes ?? 0) || 0);
      let minutes = Math.max(
        0,
        est || Number(s.scheduled_minutes ?? 0) || 0,
      );
      if (!minutes) {
        // nothing to schedule; carry prevEnd as-is and continue
        continue;
      }

      // Stage queue tail (append after what's already there)
      let tail = await getTail(s.production_stage_id);

      // earliest legal start = max(prevEnd (deps), tail (queue), baseStart (sanity))
      let start = new Date(Math.max(prevEnd.getTime(), tail.getTime(), baseStart.getTime()));
      start = nextWorkingStart(calendar, start);

      // Build contiguous minute slots
      const slots: {
        production_stage_id: string;
        stage_instance_id: string;
        slot_start_time: string;
        slot_end_time: string;
      }[] = [];

      let cur = start;
      for (let i = 0; i < minutes; i++) {
        const nxt = addOneWorkingMinute(calendar, cur);
        slots.push({
          production_stage_id: s.production_stage_id,
          stage_instance_id: s.id,
          slot_start_time: iso(cur),
          slot_end_time: iso(nxt),
        });
        cur = nxt;
      }

      if (slots.length) {
        const firstStart = slots[0].slot_start_time;
        const lastEnd = slots[slots.length - 1].slot_end_time;

        // Accumulate to batch insert (fewer network round trips)
        slotsToInsert.push(...slots);
        minutes_scheduled += slots.length;

        // Update tails + prevEnd for next stages
        const newTail = new Date(lastEnd);
        stageTail.set(s.production_stage_id, newTail);
        prevEnd = newTail;

        // Update JSI with scheduled window (we’ll batch-update one-by-one to keep simple)
        const { error: updErr } = await sb
          .from("job_stage_instances")
          .update({
            scheduled_start_at: firstStart,
            scheduled_end_at: lastEnd,
            // keep scheduled_minutes as-is (it already equals minutes, or est fallback)
          })
          .eq("id", s.id);
        if (updErr) throw updErr;
        stage_updates++;
      }
    }

    // carry job’s prev end forward in case of multiple groups per job later
    jobPrevEnd.set(jobId, prevEnd);
  }

  // 7) Insert all slots (chunked)
  let slots_inserted = 0;
  if (slotsToInsert.length) {
    slots_inserted = await batchInsert(sb, "stage_time_slots", slotsToInsert, 500);
  }

  return {
    ok: true,
    jobs_considered: byJob.size,
    stages_considered,
    minutes_scheduled,
    slots_inserted,
    stage_updates,
    message: "scheduler-run completed",
  };
}

// ------- HTTP entrypoint ----------------------------------------------------------

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405, origin });
  }

  const sb = sbClient();

  try {
    let payload: SchedulerRequest = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    const result = await executeScheduler(sb, payload ?? {});
    return json(result, { status: 200, origin });
  } catch (err) {
    console.error("scheduler-run fatal:", err);
    return json(
      { error: (err as Error).message ?? "Unknown error" },
      { status: 500, origin },
    );
  }
});
