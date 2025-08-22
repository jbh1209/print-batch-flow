// supabase/functions/scheduler-run/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge Function: scheduler-run
 * - Builds schedule windows from shifts + breaks + holidays
 * - Plans all approved jobs (respecting stage_order and resource capacity)
 * - Optional "nuclear" reset from a given date (clears + rebuilds)
 * - Applies with RPC apply_stage_updates_safe (snake_case args)
 * - Mirrors to stage_time_slots so the UI can render
 */

type UUID = string;

type Shift = {
  id: UUID;
  day_of_week: number;               // 0..6 (Sun..Sat)
  shift_start_time: string;          // "HH:mm[:ss]"
  shift_end_time: string;            // "HH:mm[:ss]"
  is_working_day: boolean;
};

type BreakRule = { start_time: string; minutes: number };

type Holiday = { date: string; name: string }; // date = "YYYY-MM-DD..."

type StageRow = {
  id: UUID;
  job_id: UUID;
  production_stage_id: UUID;         // capacity bucket
  stage_order: number | null;
  setup_minutes: number | null;
  estimated_minutes: number | null;
  // (the rest is present but not needed here)
};

type JobRow = {
  job_id: UUID;
  due_date: string | null;
  proof_approved_at: string | null;
  stages: StageRow[];
  // (meta fields omitted)
};

type SchedulerInput = {
  meta: { generated_at: string; breaks?: BreakRule[] };
  shifts: Shift[];
  holidays: Holiday[];
  routes: unknown[]; // not needed here
  jobs: JobRow[];
};

type PlacementUpdate = { id: UUID; start_at: string; end_at: string; minutes: number };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MS = 60_000;
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * MS);
const floorToMinute = (d: Date) => new Date(Math.floor(d.getTime() / MS) * MS);
const parseClock = (t: string) => {
  const [h, m, s = "0"] = t.split(":");
  return { h: +h, m: +m, s: +s };
};

type Interval = { start: Date; end: Date };

function isHoliday(holidays: Holiday[], day: Date): boolean {
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, "0");
  const d = String(day.getDate()).padStart(2, "0");
  return holidays.some(h => h.date.startsWith(`${y}-${m}-${d}`));
}

function dailyWindows(input: SchedulerInput, day: Date): Interval[] {
  const dow = day.getDay(); // 0..6 (Sun..Sat)
  const todays = input.shifts.filter(s => s.day_of_week === dow && s.is_working_day);
  const wins: Interval[] = [];

  for (const s of todays) {
    const st = parseClock(s.shift_start_time);
    const et = parseClock(s.shift_end_time);
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), st.h, st.m, +st.s);
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), et.h, et.m, +et.s);
    if (end <= start) continue;

    // begin with full shift window
    let segs: Interval[] = [{ start, end }];

    // subtract breaks
    for (const br of input.meta.breaks ?? []) {
      const bt = parseClock(br.start_time);
      const b0 = new Date(day.getFullYear(), day.getMonth(), day.getDate(), bt.h, bt.m, +bt.s);
      const b1 = addMin(b0, br.minutes);

      const next: Interval[] = [];
      for (const g of segs) {
        // no overlap
        if (b1 <= g.start || b0 >= g.end) { next.push(g); continue; }
        // left piece
        if (g.start < b0) next.push({ start: g.start, end: b0 });
        // right piece
        if (b1 < g.end)   next.push({ start: b1, end: g.end });
      }
      segs = next;
    }

    wins.push(...segs);
  }

  return wins.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Iterate future work windows, clipped to "from".
 * Always yields windows whose end > from, and starts at max(window.start, from).
 */
function* iterWindows(input: SchedulerInput, from: Date, horizonDays = 365): Generator<Interval> {
  const seed = floorToMinute(from);
  for (let i = 0; i < horizonDays; i++) {
    const day = addMin(new Date(seed.getFullYear(), seed.getMonth(), seed.getDate()), i * 24 * 60);
    if (isHoliday(input.holidays, day)) continue;

    for (const w of dailyWindows(input, day)) {
      if (w.end <= seed) continue;
      const s = new Date(Math.max(w.start.getTime(), seed.getTime()));
      yield { start: s, end: w.end };
    }
  }
}

/** First working minute on/after "from". */
function nextWorkingStart(input: SchedulerInput, from: Date): Date {
  for (const w of iterWindows(input, from, 365)) return w.start;
  return floorToMinute(from);
}

/**
 * Place "minutes" contiguously from "earliest", across windows (no gaps
 * other than outside working windows/breaks).
 */
function placeDuration(input: SchedulerInput, earliest: Date, minutes: number): Interval[] {
  let left = Math.max(0, Math.ceil(minutes));
  const placed: Interval[] = [];
  let cursor = floorToMinute(earliest);

  for (const w of iterWindows(input, cursor)) {
    if (left <= 0) break;

    // usable minutes inside this window from the cursor
    const available = Math.floor((w.end.getTime() - Math.max(w.start.getTime(), cursor.getTime())) / MS);
    const use = Math.min(available, left);
    if (use > 0) {
      const s = new Date(Math.max(w.start.getTime(), cursor.getTime()));
      const e = addMin(s, use);
      placed.push({ start: s, end: e });
      left -= use;
      cursor = e; // continue right after this segment
    }
  }

  return placed;
}

function planSchedule(input: SchedulerInput, baseStart?: Date) {
  // global floor to avoid ever starting in the past
  const nowFloor = floorToMinute(new Date());
  const globalMin = baseStart ? baseStart : nextWorkingStart(input, nowFloor);

  // filter to jobs that are live (proof approved)
  const jobs = input.jobs
    .filter(j => j.proof_approved_at)
    .map(j => ({ ...j, approvedAt: new Date(j.proof_approved_at as string) }))
    .sort((a, b) => a.approvedAt.getTime() - b.approvedAt.getTime());

  // resource -> when it's next free
  const resourceFree = new Map<UUID, Date>();

  const updates: PlacementUpdate[] = [];

  for (const job of jobs) {
    // stage order within the job
    const stages = [...job.stages].sort((a, b) => (a.stage_order ?? 9999) - (b.stage_order ?? 9999));
    const orders = Array.from(new Set(stages.map(s => s.stage_order ?? 9999))).sort((a, b) => a - b);
    const doneAt = new Map<UUID, Date>(); // stage_id -> end time

    for (const ord of orders) {
      for (const st of stages.filter(s => (s.stage_order ?? 9999) === ord)) {
        const resource = st.production_stage_id;

        // earliest is max(approval, globalMin, predecessors end, resource free)
        let earliest = job.approvedAt;
        earliest = new Date(Math.max(earliest.getTime(), globalMin.getTime()));

        for (const prev of stages) {
          if ((prev.stage_order ?? 9999) < (st.stage_order ?? 9999)) {
            const prevEnd = doneAt.get(prev.id);
            if (prevEnd && prevEnd > earliest) earliest = prevEnd;
          }
        }

        const free = resourceFree.get(resource);
        if (free && free > earliest) earliest = free;

        const mins = Math.max(0, Math.round((st.estimated_minutes ?? 0) + (st.setup_minutes ?? 0)));
        const segs = mins > 0 ? placeDuration(input, earliest, mins) : [{ start: earliest, end: earliest }];
        const start = segs[0].start, end = segs[segs.length - 1].end;

        updates.push({
          id: st.id,
          start_at: start.toISOString(),
          end_at:   end.toISOString(),
          minutes:  mins,
        });

        doneAt.set(st.id, end);
        resourceFree.set(resource, end);  // keep resource contiguous
      }
    }
  }

  return { updates };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const qp = (k: string, def: string) => (url.searchParams.get(k) ?? (body as any)[k] ?? def);

    // Controls
    const commit       = qp("commit", "true") === "true";
    const proposed     = qp("proposed", "true") === "true";
    const onlyIfUnset  = qp("onlyIfUnset", "true") === "true";
    const nuclear      = qp("nuclear", "false") === "true";
    const startFrom    = qp("startFrom", "");               // "YYYY-MM-DD" (local date)
    const wipeAll      = qp("wipeAll", "false") === "true"; // clear manual too (if your RPC supports it)

    const supabaseUrl  = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL_INTERNAL");
    const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1) Snapshot export
    const { data: snap, error: exportErr } = await supabase.rpc("export_scheduler_input");
    if (exportErr) throw new Error("export_scheduler_input failed: " + JSON.stringify(exportErr));
    const input = snap as SchedulerInput;

    // 2) Calculate a base start for nuclear rebuilds (and clear)
    let baseStart: Date | undefined;
    if (nuclear) {
      // Seed from startFrom's local midnight, else "now"; then snap to next working minute
      const seed = startFrom
        ? new Date(`${startFrom}T00:00:00`)
        : new Date();
      baseStart = nextWorkingStart(input, seed);

      if (commit) {
        // Clear any auto-scheduled rows from that date forward
        const { error: clearErr } = await supabase.rpc("unschedule_auto_stages", {
          from_date: baseStart.toISOString().slice(0, 10),
          wipe_all: wipeAll
        });
        if (clearErr) throw new Error("unschedule_auto_stages failed: " + JSON.stringify(clearErr));
      }
    }

    // 3) Plan schedule (never allows past — planSchedule caps to working >= now or >= baseStart)
    const { updates } = planSchedule(input, baseStart);

    // 4) Apply and mirror for UI
    let applied: unknown = { updated: 0 };
    if (commit && updates.length) {
      const { data, error } = await supabase.rpc("apply_stage_updates_safe", {
        updates,
        commit: true,
        only_if_unset: onlyIfUnset,     // NOTE: snake_case
        as_proposed: proposed           // NOTE: snake_case
      });
      if (error) throw new Error("apply_stage_updates_safe failed: " + JSON.stringify(error));
      applied = data;

      // Mirror to the calendar table your UI reads
      const ids = updates.map(u => u.id);
      const { error: mirrorErr } = await supabase.rpc("mirror_jsi_to_stage_time_slots", { p_stage_ids: ids });
      if (mirrorErr) throw new Error("mirror_jsi_to_stage_time_slots failed: " + JSON.stringify(mirrorErr));
    }

    return new Response(JSON.stringify({ ok: true, scheduled: updates.length, applied, baseStart }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
