// supabase/functions/scheduler-run/index.ts
// Schedules newly-approved jobs (or all jobs, if you want), respecting working hours,
// holidays, lunch breaks, machine exclusivity, and stage dependencies.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* -------------------- CORS -------------------- */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* -------------------- Types (loose to match your snapshot) -------------------- */
type UUID = string;

type ShiftRow = {
  day_of_week: number;            // 0..6, Sun..Sat
  shift_start_time: string;       // "08:00:00"
  shift_end_time: string;         // "16:30:00"
  is_working_day: boolean;
};

type HolidayRow = { date: string; name: string };

type StageRow = {
  id: UUID;                       // job_stage_instances.id
  job_id: UUID;
  production_stage_id: UUID;
  stage_order: number | null;     // dependency tier
  // Stage name/group if present in your export (we’ll use it to skip PROOF/DTP/BATCH)
  stage_name?: string | null;
  stage_group?: string | null;

  // Various duration fields that may exist in your DB:
  estimated_minutes?: number | null;
  setup_minutes?: number | null;

  // Canonical columns we actually rely on after your latest dumps:
  estimated_duration_minutes?: number | null; // jsi.estimated_duration_minutes
  setup_time_minutes?: number | null;         // jsi.setup_time_minutes
  scheduled_minutes?: number | null;          // jsi.scheduled_minutes (pre-filled)
};

type JobRow = {
  job_id: UUID;
  wo_number?: string | null;
  customer_name?: string | null;
  quantity?: number | null;
  due_date?: string | null;
  proof_approved_at: string | null;
  stages: StageRow[];
};

type Snapshot = {
  meta: { generated_at: string; breaks?: { start_time: string; minutes: number }[] };
  shifts: ShiftRow[];
  holidays: HolidayRow[];
  routes?: any;
  jobs: JobRow[];
};

type PlacementUpdate = { id: UUID; start_at: string; end_at: string; minutes: number };

/* -------------------- Time helpers -------------------- */
const MS = 60_000;
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * MS);
const parseClock = (t: string) => { const [h, m, s = "0"] = t.split(":"); return { h: +h, m: +m, s: +s }; };

// boolean coercion for qp/body flags
const asBool = (v: unknown, def: boolean) => {
  if (v === undefined || v === null) return def;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase().trim();
  return s === "true" || s === "1";
};

/* -------------------- Calendar windows (respects shifts, breaks, holidays) -------------------- */
function isHoliday(holidays: HolidayRow[], day: Date) {
  const y = day.getFullYear(), m = String(day.getMonth() + 1).padStart(2, "0"), d = String(day.getDate()).padStart(2, "0");
  return holidays.some(h => h.date.startsWith(`${y}-${m}-${d}`));
}

type Interval = { start: Date; end: Date };

function dailyWindows(input: Snapshot, day: Date): Interval[] {
  const dow = day.getDay();
  const todays = input.shifts.filter(s => s.day_of_week === dow && s.is_working_day);
  const wins: Interval[] = [];

  for (const s of todays) {
    const st = parseClock(s.shift_start_time), et = parseClock(s.shift_end_time);
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), st.h, st.m, +st.s);
    const end   = new Date(day.getFullYear(), day.getMonth(), day.getDate(), et.h, et.m, +et.s);
    if (end <= start) continue;

    let segs: Interval[] = [{ start, end }];

    // Split out lunch (and any other breaks you configure in export_scheduler_input.meta.breaks)
    for (const br of input.meta.breaks ?? []) {
      const bt = parseClock(br.start_time);
      const b0 = new Date(day.getFullYear(), day.getMonth(), day.getDate(), bt.h, bt.m, +bt.s);
      const b1 = addMin(b0, br.minutes);
      const next: Interval[] = [];
      for (const g of segs) {
        if (b1 <= g.start || b0 >= g.end) next.push(g);
        else {
          if (g.start < b0) next.push({ start: g.start, end: b0 });
          if (b1 < g.end)   next.push({ start: b1, end: g.end });
        }
      }
      segs = next;
    }
    wins.push(...segs);
  }

  // strictly sorted
  return wins.sort((a,b) => a.start.getTime() - b.start.getTime());
}

function* iterWindows(input: Snapshot, from: Date, horizonDays = 365): Generator<Interval> {
  for (let i = 0; i < horizonDays; i++) {
    const day = addMin(new Date(from.getFullYear(), from.getMonth(), from.getDate()), i * 24 * 60);
    if (isHoliday(input.holidays, day)) continue;
    for (const w of dailyWindows(input, day)) {
      if (w.end <= from) continue;
      const s = new Date(Math.max(w.start.getTime(), from.getTime()));
      yield { start: s, end: w.end };
    }
  }
}

function placeDuration(input: Snapshot, earliest: Date, minutes: number): Interval[] {
  let left = Math.max(0, Math.ceil(minutes));
  const placed: Interval[] = [];
  let cursor = new Date(earliest);

  for (const w of iterWindows(input, cursor)) {
    if (left <= 0) break;
    const cap = Math.floor((w.end.getTime() - Math.max(w.start.getTime(), cursor.getTime())) / MS);
    const use = Math.min(cap, left);
    if (use > 0) {
      const s = new Date(Math.max(w.start.getTime(), cursor.getTime()));
      const e = addMin(s, use);
      placed.push({ start: s, end: e });
      left -= use;
      cursor = e;
    }
  }
  return placed;
}

function nextWorkingStart(input: Snapshot, from: Date): Date {
  for (const w of iterWindows(input, from)) return w.start;
  return from;
}

/* -------------------- Core planner -------------------- */

// exclude very-early pipeline stages from scheduling board if you want
const EXCLUDE_STAGE_NAMES = new Set(["PROOF", "DTP", "BATCH"]);

function minutesForStage(st: StageRow): number {
  // Order of preference (run + setup):
  // run: scheduled_minutes (if already computed) → estimated_duration_minutes → estimated_minutes → 0
  // setup: setup_time_minutes → setup_minutes → 0
  const run =
    (st.scheduled_minutes ?? st.estimated_duration_minutes ?? st.estimated_minutes ?? 0) as number;
  const setup =
    (st.setup_time_minutes ?? st.setup_minutes ?? 0) as number;

  return Math.max(1, Math.round(run + setup)); // never zero
}

function planSchedule(input: Snapshot, baseStart?: Date, onlyJobIds?: UUID[]) {
  // Filter jobs: approved and optionally restricted list
  const jobs = input.jobs
    .filter(j => j.proof_approved_at)
    .filter(j => !onlyJobIds || onlyJobIds.includes(j.job_id))
    .map(j => ({ ...j, approvedAt: new Date(j.proof_approved_at as string) }))
    .sort((a, b) => a.approvedAt.getTime() - b.approvedAt.getTime());

  const resourceFree = new Map<UUID, Date>();     // production_stage_id → next free time
  const doneAtByStage = new Map<UUID, Date>();    // stage_instance_id → end time
  const updates: PlacementUpdate[] = [];

  for (const job of jobs) {
    // Respect dependencies: lower stage_order must complete first.
    const stages = [...job.stages]
      // optionally exclude DTP/PROOF/BATCH rows from being placed on the board
      .filter(s => !s.stage_name || !EXCLUDE_STAGE_NAMES.has(String(s.stage_name).toUpperCase()))
      .sort((a,b) => (a.stage_order ?? 9999) - (b.stage_order ?? 9999));

    // Distinct "tiers" (all of the same order can run in parallel if on different resources)
    const orders = Array.from(new Set(stages.map(s => s.stage_order ?? 9999))).sort((a,b)=>a-b);

    for (const ord of orders) {
      // For every stage in this tier
      const tierStages = stages.filter(s => (s.stage_order ?? 9999) === ord);
      for (const st of tierStages) {
        const resource = st.production_stage_id;

        // Earliest start is max of: job approvedAt, baseStart (if nuclear), predecessors’ end, resource-free
        let earliest = job.approvedAt;
        if (baseStart) earliest = new Date(Math.max(earliest.getTime(), baseStart.getTime()));

        // Predecessors = any stage with lower order (we already sorted and have tiers)
        for (const pred of stages) {
          if ((pred.stage_order ?? 9999) < (st.stage_order ?? 9999)) {
            const predEnd = doneAtByStage.get(pred.id);
            if (predEnd && predEnd > earliest) earliest = predEnd;
          }
        }

        const free = resourceFree.get(resource);
        if (free && free > earliest) earliest = free;

        // Actual minutes:
        const mins = minutesForStage(st);

        // Place across working windows (auto carries over past 16:30, skips lunch & holidays)
        const segs = placeDuration(input, earliest, mins);
        const start = segs[0].start;
        const end   = segs[segs.length - 1].end;

        updates.push({ id: st.id, start_at: start.toISOString(), end_at: end.toISOString(), minutes: mins });

        doneAtByStage.set(st.id, end);
        resourceFree.set(resource, end);
      }
    }
  }

  return { updates, jobs_considered: jobs.length };
}

/* -------------------- HTTP handler -------------------- */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // flags & filters
    const commit      = asBool(url.searchParams.get("commit")      ?? (body as any).commit,      true);
    const proposed    = asBool(url.searchParams.get("proposed")    ?? (body as any).proposed,    false);
    const onlyIfUnset = asBool(url.searchParams.get("onlyIfUnset") ?? (body as any).onlyIfUnset, true);
    const nuclear     = asBool(url.searchParams.get("nuclear")     ?? (body as any).nuclear,     false);
    const wipeAll     = asBool(url.searchParams.get("wipeAll")     ?? (body as any).wipeAll,     false);

    // Optional: schedule only these job IDs (array of UUIDs as JSON)
    const onlyJobIds: UUID[] | undefined = (body as any).onlyJobIds ?? undefined;

    // Optional nuclear anchor date (yyyy-mm-dd). If omitted, we shift from "tomorrow".
    const startFromStr = (url.searchParams.get("startFrom") ?? (body as any).startFrom ?? "") as string;
    const startFrom = startFromStr ? new Date(startFromStr) : null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL_INTERNAL");
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1) Snapshot from DB
    const { data: snap, error: exportErr } = await supabase.rpc("export_scheduler_input");
    if (exportErr) throw new Error("export_scheduler_input failed: " + JSON.stringify(exportErr));
    const input = snap as Snapshot;

    // 2) Nuclear base start (and optional clearing)
    let baseStart: Date | undefined;
    if (nuclear) {
      const seed = startFrom ? startFrom : addMin(new Date(), 24 * 60); // default = tomorrow
      baseStart = nextWorkingStart(input, seed);
      if (commit) {
        // tolerant wipe: try (from_date, wipe_all) → fall back to (from_date)
        const from_date = baseStart.toISOString().slice(0, 10);
        if (wipeAll) {
          const { error: e1 } = await supabase.rpc("unschedule_auto_stages", { from_date, wipe_all: true });
          if (e1) {
            const { error: e2 } = await supabase.rpc("unschedule_auto_stages", { from_date });
            if (e2) throw new Error("unschedule_auto_stages failed (wipe_all + fallback): " + JSON.stringify({ e1, e2 }));
          }
        } else {
          const { error } = await supabase.rpc("unschedule_auto_stages", { from_date });
          if (error) throw new Error("unschedule_auto_stages failed: " + JSON.stringify(error));
        }
      }
    }

    // 3) Plan (optionally for only specific jobs)
    const { updates, jobs_considered } = planSchedule(input, baseStart, onlyJobIds);

    // 4) Apply to DB (job_stage_instances.*_at + *_minutes). The UI reads from JSI.
    let applied: unknown = { updated: 0 };
    if (commit && updates.length) {
      const { data, error } = await supabase.rpc("apply_stage_updates_safe", {
        updates,
        commit: true,
        only_if_unset: onlyIfUnset,
        as_proposed: proposed,
      });
      if (error) throw new Error("apply_stage_updates_safe failed: " + JSON.stringify(error));
      applied = data;
    }

    return new Response(JSON.stringify({
      ok: true,
      jobs_considered,
      scheduled: updates.length,
      applied,
      nuclear,
      onlyJobIds: onlyJobIds?.length ?? 0,
      baseStart: baseStart?.toISOString() ?? null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
