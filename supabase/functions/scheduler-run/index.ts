// supabase/functions/scheduler-run/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type UUID = string;

type Shift = {
  id: UUID;
  day_of_week: number;           // 0..6
  shift_start_time: string;      // "08:00:00"
  shift_end_time: string;        // "17:00:00"
  is_working_day: boolean;
};

type Holiday = { date: string; name: string };

type BreakDef = { start_time: string; minutes: number };

type StageRow = {
  id: UUID;
  job_id: UUID;
  status: string;
  quantity: number | null;
  job_table: string;
  stage_name: string;
  stage_group: string | null;
  stage_order: number | null;
  setup_minutes: number;
  estimated_minutes: number;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  scheduled_minutes: number | null;
  schedule_status: string | null;
  production_stage_id: UUID;
};

type JobRow = {
  job_id: UUID;
  wo_number: string;
  customer_name: string;
  quantity: number;
  due_date: string | null;
  proof_approved_at: string | null;
  estimated_run_minutes: number;
  stages: StageRow[];
};

type SchedulerInput = {
  meta: { generated_at: string; breaks?: BreakDef[] };
  shifts: Shift[];
  holidays: Holiday[];
  routes: { category_id: UUID; production_stage_id: UUID; stage_order: number }[];
  jobs: JobRow[];
};

type PlacementUpdate = { id: UUID; start_at: string; end_at: string; minutes: number };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MS = 60_000;
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * MS);
const parseClock = (t: string) => { const [h, m, s = "0"] = t.split(":"); return { h:+h, m:+m, s:+s }; };

function isHoliday(holidays: Holiday[], day: Date) {
  const y = day.getFullYear(), m = String(day.getMonth() + 1).padStart(2, "0"), d = String(day.getDate()).padStart(2, "0");
  return holidays.some(h => h.date.startsWith(`${y}-${m}-${d}`));
}

type Interval = { start: Date; end: Date };

function dailyWindows(input: SchedulerInput, day: Date): Interval[] {
  const dow = day.getDay();
  const todays = input.shifts.filter(s => s.day_of_week === dow && s.is_working_day);
  const wins: Interval[] = [];

  for (const s of todays) {
    const st = parseClock(s.shift_start_time), et = parseClock(s.shift_end_time);
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), st.h, st.m, +st.s);
    const end   = new Date(day.getFullYear(), day.getMonth(), day.getDate(), et.h, et.m, +et.s);
    if (end <= start) continue;

    let segs: Interval[] = [{ start, end }];

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
  return wins.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function* iterWindows(input: SchedulerInput, from: Date, horizonDays = 365) {
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

function placeDuration(input: SchedulerInput, earliest: Date, minutes: number): Interval[] {
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

function nextWorkingStart(input: SchedulerInput, from: Date): Date {
  for (const w of iterWindows(input, from)) return w.start;
  return from;
}

function planSchedule(input: SchedulerInput, baseStart?: Date) {
  const jobs = input.jobs
    .filter(j => j.proof_approved_at)
    .map(j => ({ ...j, approvedAt: new Date(j.proof_approved_at!) }))
    .sort((a, b) => a.approvedAt.getTime() - b.approvedAt.getTime());

  const resourceFree = new Map<UUID, Date>();
  const updates: PlacementUpdate[] = [];
  for (const job of jobs) {
    const stages = [...job.stages].sort((a, b) => (a.stage_order ?? 9999) - (b.stage_order ?? 9999));
    const orders = Array.from(new Set(stages.map(s => s.stage_order ?? 9999))).sort((a, b) => a - b);
    const doneAt = new Map<UUID, Date>();

    for (const ord of orders) {
      for (const st of stages.filter(s => (s.stage_order ?? 9999) === ord)) {
        const resource = st.production_stage_id;

        // earliest = max(approval, baseStart, predecessor end, resource free)
        let earliest = job.approvedAt;
        if (baseStart) earliest = new Date(Math.max(earliest.getTime(), baseStart.getTime()));
        for (const prev of stages) {
          if ((prev.stage_order ?? 9999) < (st.stage_order ?? 9999)) {
            const end = doneAt.get(prev.id);
            if (end && end > earliest) earliest = end;
          }
        }
        const free = resourceFree.get(resource);
        if (free && free > earliest) earliest = free;

        const mins = Math.max(0, Math.round((st.estimated_minutes || 0) + (st.setup_minutes || 0)));
        const segs = mins ? placeDuration(input, earliest, mins) : [{ start: earliest, end: earliest }];
        const start = segs[0].start, end = segs[segs.length - 1].end;

        updates.push({ id: st.id, start_at: start.toISOString(), end_at: end.toISOString(), minutes: mins });
        doneAt.set(st.id, end);
        resourceFree.set(resource, end);
      }
    }
  }
  return { updates };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url  = new URL(req.url);
    const body = req.method === "POST" ? (await req.json().catch(() => ({}))) : {};
    const qp   = (k: string, def: string) => (url.searchParams.get(k) ?? (body as any)[k] ?? def);

    const commit      = qp("commit", "true") === "true";
    const proposed    = qp("proposed", "true") === "true";
    const onlyIfUnset = qp("onlyIfUnset", "true") === "true";
    const nuclear     = qp("nuclear", "false") === "true";
    const startFrom   = qp("startFrom", "");                 // yyyy-mm-dd
    const wipeAll     = qp("wipeAll", "false") === "true";

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL_INTERNAL");
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1) Snapshot
    const { data: snap, error: exportErr } = await supabase.rpc("export_scheduler_input");
    if (exportErr) throw new Error("export_scheduler_input failed: " + JSON.stringify(exportErr));
    const input = snap as SchedulerInput;

    // 2) Base start + wipe (nuclear)
    let baseStart: Date | undefined;
    if (nuclear) {
      // treat the provided yyyy-mm-dd as a local date at midnight
      const seed = startFrom ? new Date(startFrom + "T00:00:00") : new Date();
      baseStart = nextWorkingStart(input, seed);

      if (commit) {
        const { error: clearErr } = await supabase.rpc("unschedule_auto_stages", {
          from_date: baseStart.toISOString().slice(0, 10),
          wipe_all: wipeAll
        });
        if (clearErr) throw new Error("unschedule_auto_stages failed: " + JSON.stringify(clearErr));
      }
    }

    // 3) Plan
    const { updates } = planSchedule(input, baseStart);

    // 4) Apply + mirror
    let applied: unknown = { updated: 0 };
    if (commit && updates.length) {
      const { data, error } = await supabase.rpc("apply_stage_updates_safe", {
        updates,
        commit: true,
        only_if_unset: onlyIfUnset,   // snake_case params
        as_proposed: proposed         // snake_case params
      });
      if (error) throw new Error("apply_stage_updates_safe failed: " + JSON.stringify(error));
      applied = data;

      // IMPORTANT: mirror to the board table
      const ids = updates.map(u => u.id);
      const { error: mirrorErr } = await supabase.rpc("mirror_jsi_to_stage_time_slots", { p_stage_ids: ids });
      if (mirrorErr) throw new Error("mirror_jsi_to_stage_time_slots failed: " + JSON.stringify(mirrorErr));
    }

    return new Response(JSON.stringify({ ok: true, scheduled: updates.length, applied, baseStart }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
