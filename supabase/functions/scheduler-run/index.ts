// /supabase/functions/scheduler-run/index.ts
// Schedules approved jobs into working windows with breaks/holidays,
// packed contiguously per resource, never in the past.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DateTime, Interval } from "https://esm.sh/luxon@3";

// -------------------- Config --------------------
const ZONE = Deno.env.get("PLANT_TZ") ?? "Africa/Johannesburg";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// -------------------- Types --------------------
type UUID = string;

interface SchedulerInput {
  meta: { generated_at: string; breaks?: { start_time: string; minutes: number }[] };
  shifts: {
    id: UUID;
    day_of_week: number;              // 0=Sun ... 6=Sat
    shift_start_time: string;         // "HH:mm" (plant time)
    shift_end_time: string;
    is_working_day: boolean;
  }[];
  holidays: { date: string; name: string }[]; // date-only "YYYY-MM-DD" in plant time
  routes: { category_id: UUID; production_stage_id: UUID; stage_order: number }[];
  jobs: JobRow[];
}

interface JobRow {
  job_id: UUID;
  wo_number: string;
  customer_name: string;
  quantity: number;
  due_date: string | null;
  proof_approved_at: string | null;   // ISO
  estimated_run_minutes: number;
  stages: StageRow[];
}

interface StageRow {
  id: UUID;
  job_id: UUID;
  status: string;
  quantity: number | null;
  job_table: string;
  stage_name: string;
  stage_group: string | null;
  stage_order: number | null;
  setup_minutes: number;              // may be 0
  estimated_minutes: number;          // may be 0
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  scheduled_minutes: number | null;
  schedule_status: string | null;
  production_stage_id: UUID;
}

interface PlacementUpdate {
  id: UUID;
  start_at: string; // ISO UTC
  end_at: string;   // ISO UTC
  minutes: number;
}

// -------------------- Time helpers (Luxon) --------------------
const zoneNow = () => DateTime.now().setZone(ZONE);

// "2025-08-15" -> start of that day in plant zone
const dateOnlyStart = (yyyyMmDd: string) =>
  DateTime.fromISO(yyyyMmDd, { zone: ZONE }).startOf("day");

// "HH:mm[:ss]" on a given day (plant zone)
function atClock(day: DateTime, hhmmss: string) {
  const [h, m, s = "0"] = hhmmss.split(":");
  return day.set({
    hour: Number(h),
    minute: Number(m),
    second: Number(s),
    millisecond: 0,
  });
}

function isHoliday(holidays: { date: string }[], day: DateTime) {
  const d = day.toISODate(); // date-only in zone
  return holidays.some((h) => h.date === d);
}

// Split a working day into usable windows after removing breaks
function windowsForDay(input: SchedulerInput, day: DateTime): Interval[] {
  // DB uses 0..6 (Sun..Sat). Luxon weekday is 1..7 (Mon..Sun).
  const dow = day.weekday % 7; // Mon->1, ..., Sun->0
  const todays = input.shifts.filter((s) => s.day_of_week === dow && s.is_working_day);

  const breaks = (input.meta.breaks ?? []).map((b) => ({
    start: atClock(day, b.start_time),
    end: atClock(day, b.start_time).plus({ minutes: b.minutes }),
  }));

  const out: Interval[] = [];
  for (const s of todays) {
    let seg = Interval.fromDateTimes(
      atClock(day, s.shift_start_time),
      atClock(day, s.shift_end_time),
    );
    if (!seg.isValid || seg.length("minutes") <= 0) continue;

    // Carve out breaks
    let segments: Interval[] = [seg];
    for (const br of breaks) {
      const next: Interval[] = [];
      for (const g of segments) {
        if (!g.overlaps(br)) {
          next.push(g);
          continue;
        }
        const before = Interval.fromDateTimes(g.start, br.start);
        const after = Interval.fromDateTimes(br.end, g.end);
        if (before.isValid && before.length("minutes") > 0) next.push(before);
        if (after.isValid && after.length("minutes") > 0) next.push(after);
      }
      segments = next;
    }
    out.push(...segments);
  }
  return out.sort((a, b) => a.start.toMillis() - b.start.toMillis());
}

// Generate usable windows after a given cursor (inclusive)
function* iterWindows(input: SchedulerInput, from: DateTime, horizonDays = 365) {
  const day0 = from.startOf("day");
  for (let i = 0; i < horizonDays; i++) {
    const day = day0.plus({ days: i });
    if (isHoliday(input.holidays, day)) continue;
    for (const win of windowsForDay(input, day)) {
      const usable = Interval.fromDateTimes(DateTime.max(win.start, from), win.end);
      if (usable.isValid && usable.length("minutes") > 0) yield usable;
    }
  }
}

// First working instant on/after seed
function nextWorkingStart(input: SchedulerInput, seed: DateTime): DateTime {
  for (const seg of iterWindows(input, seed, 365)) return seg.start;
  return seed; // fallback (no windows configured)
}

// Greedy contiguous placement inside windows
function placeDuration(
  input: SchedulerInput,
  earliest: DateTime,
  minutes: number,
): Interval[] {
  let left = Math.max(0, Math.ceil(minutes));
  if (left === 0) return [Interval.fromDateTimes(earliest, earliest)];

  const placed: Interval[] = [];
  let cursor = earliest;

  for (const seg of iterWindows(input, cursor)) {
    if (left <= 0) break;
    const cap = Math.floor(seg.length("minutes"));
    const use = Math.min(cap, left);
    if (use > 0) {
      const s = seg.start;
      const e = s.plus({ minutes: use });
      placed.push(Interval.fromDateTimes(s, e));
      left -= use;
      cursor = e;
    } else {
      cursor = seg.end;
    }
  }
  return placed;
}

// -------------------- Planner --------------------
function planSchedule(input: SchedulerInput, baseStartISO?: string) {
  const now = zoneNow();

  const baseStartSeed = baseStartISO ? dateOnlyStart(baseStartISO) : undefined;
  const baseStart = baseStartSeed ? nextWorkingStart(input, baseStartSeed) : undefined;

  // Approved jobs oldest-first
  const jobs = input.jobs
    .filter((j) => j.proof_approved_at)
    .map((j) => ({
      ...j,
      approvedAt: DateTime.fromISO(j.proof_approved_at!, { zone: ZONE }),
    }))
    .sort((a, b) => a.approvedAt.toMillis() - b.approvedAt.toMillis());

  const resourceFree = new Map<UUID, DateTime>();
  const updates: PlacementUpdate[] = [];

  for (const job of jobs) {
    const stages = [...job.stages].sort(
      (a, b) => (a.stage_order ?? 9999) - (b.stage_order ?? 9999),
    );

    const doneAt = new Map<UUID, DateTime>(); // per-job predecessor completion

    for (const st of stages) {
      // Earliest = max(approval, baseStart?, resourceFree, now)
      let earliest = job.approvedAt;
      if (baseStart) earliest = DateTime.max(earliest, baseStart);
      earliest = DateTime.max(earliest, now);

      // Predecessors (same job)
      for (const prev of stages) {
        if ((prev.stage_order ?? 9999) < (st.stage_order ?? 9999)) {
          const endPrev = doneAt.get(prev.id);
          if (endPrev) earliest = DateTime.max(earliest, endPrev);
        }
      }

      // Resource contiguity
      const free = resourceFree.get(st.production_stage_id);
      if (free) earliest = DateTime.max(earliest, free);

      // Snap into next valid window if between segments
      earliest = nextWorkingStart(input, earliest);

      const mins = Math.max(
        0,
        Math.round((st.estimated_minutes || 0) + (st.setup_minutes || 0)),
      );
      const segs = placeDuration(input, earliest, mins);

      const start = segs[0].start;
      const end = segs[segs.length - 1].end;

      updates.push({
        id: st.id,
        start_at: start.toUTC().toISO()!, // Persist as UTC ISO
        end_at: end.toUTC().toISO()!,
        minutes: mins,
      });

      doneAt.set(st.id, end);
      resourceFree.set(st.production_stage_id, end);
    }
  }

  return { updates };
}

// -------------------- HTTP handler --------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? (await req.json().catch(() => ({}))) : {};
    const qp = (k: string, def: string) => url.searchParams.get(k) ?? (body as any)[k] ?? def;

    const commit      = qp("commit", "true") === "true";
    const proposed    = qp("proposed", "true") === "true";
    const onlyIfUnset = qp("onlyIfUnset", "true") === "true";
    const nuclear     = qp("nuclear", "false") === "true";
    const startFrom   = qp("startFrom", "");  // "YYYY-MM-DD" (plant local date)
    const wipeAll     = qp("wipeAll", "false") === "true";

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL_INTERNAL");
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1) Snapshot data for planner
    const { data: snap, error: exportErr } = await supabase.rpc("export_scheduler_input");
    if (exportErr) throw new Error("export_scheduler_input failed: " + JSON.stringify(exportErr));
    const input = snap as SchedulerInput;

    // 2) Nuclear: compute start day + clear
    let baseStartISO: string | undefined;
    if (nuclear) {
      const now = zoneNow();
      const seed = startFrom
        ? dateOnlyStart(startFrom)
        : now.plus({ days: 1 }).startOf("day");              // default: tomorrow
      const startDt = nextWorkingStart(input, seed);
      baseStartISO = startDt.toISODate();                    // date-only for planner/clear

      if (commit) {
        const { error: clearErr } = await supabase.rpc("unschedule_auto_stages", {
          from_date: baseStartISO,
          wipe_all: wipeAll,
        });
        if (clearErr) throw new Error("unschedule_auto_stages failed: " + JSON.stringify(clearErr));
      }
    }

    // 3) Plan
    const { updates } = planSchedule(input, baseStartISO);

    // 4) Apply
    let applied: unknown = { updated: 0 };
    if (commit && updates.length) {
      const { data, error } = await supabase.rpc("apply_stage_updates_safe", {
        updates,                 // [{id,start_at,end_at,minutes}]
        commit: true,
        only_if_unset: onlyIfUnset,
        as_proposed: proposed,
      });
      if (error) throw new Error("apply_stage_updates_safe failed: " + JSON.stringify(error));
      applied = data;
    }

    return new Response(JSON.stringify({ ok: true, scheduled: updates.length, applied, baseStart: baseStartISO, zone: ZONE }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
