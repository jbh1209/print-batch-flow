// supabase/functions/scheduler-run/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** CORS */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type UUID = string;

interface SchedulerInput {
  meta: {
    generated_at: string;
    breaks?: { start_time: string; minutes: number }[];
  };
  shifts: { id: UUID; day_of_week: number; shift_start_time: string; shift_end_time: string; is_working_day: boolean }[];
  holidays: { date: string; name: string }[];
  routes: { category_id: UUID; production_stage_id: UUID; stage_order: number }[];
  jobs: JobRow[];
}
interface JobRow {
  job_id: UUID;
  wo_number: string;
  customer_name: string;
  quantity: number;
  due_date: string | null;
  proof_approved_at: string | null;
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
  setup_minutes: number;
  estimated_minutes: number;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  scheduled_minutes: number | null;
  schedule_status: string | null;
  production_stage_id: UUID;
}

interface Placement { start: Date; end: Date }
interface Update { id: UUID; start_at: string; end_at: string; minutes: number }

const MS = 60_000;
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * MS);
const parseClock = (t: string) => { const [h, m, s = "0"] = t.split(":"); return { h:+h, m:+m, s:+s }; };

/** Is YYYY-MM-DD a holiday? */
function isHoliday(holidays: SchedulerInput["holidays"], day: Date) {
  const y = day.getUTCFullYear(), m = String(day.getUTCMonth() + 1).padStart(2, "0"), d = String(day.getUTCDate()).padStart(2, "0");
  return holidays.some((h) => h.date.startsWith(`${y}-${m}-${d}`));
}

/** Build working windows (UTC in edge runtime) */
function dailyWindows(input: SchedulerInput, dayUTC: Date): Placement[] {
  const dow = dayUTC.getUTCDay();
  const todays = input.shifts.filter(s => s.day_of_week === dow && s.is_working_day);
  const wins: Placement[] = [];

  for (const s of todays) {
    const st = parseClock(s.shift_start_time);
    const et = parseClock(s.shift_end_time);
    const start = new Date(Date.UTC(dayUTC.getUTCFullYear(), dayUTC.getUTCMonth(), dayUTC.getUTCDate(), st.h, st.m, +st.s));
    const end   = new Date(Date.UTC(dayUTC.getUTCFullYear(), dayUTC.getUTCMonth(), dayUTC.getUTCDate(), et.h, et.m, +et.s));
    if (end <= start) continue;

    // Start with full shift window, then cut out breaks
    let segs: Placement[] = [{ start, end }];
    for (const br of input.meta.breaks ?? []) {
      const bt = parseClock(br.start_time);
      const b0 = new Date(Date.UTC(dayUTC.getUTCFullYear(), dayUTC.getUTCMonth(), dayUTC.getUTCDate(), bt.h, bt.m, +bt.s));
      const b1 = addMin(b0, br.minutes);

      const next: Placement[] = [];
      for (const g of segs) {
        if (b1 <= g.start || b0 >= g.end) { next.push(g); continue; }
        if (g.start < b0) next.push({ start: g.start, end: b0 });
        if (b1 < g.end)   next.push({ start: b1, end: g.end });
      }
      segs = next;
    }
    wins.push(...segs);
  }

  return wins.sort((a,b)=>a.start.getTime() - b.start.getTime());
}

/** Iterate windows from a given instant forward (UTC) */
function* iterWindows(input: SchedulerInput, fromUTC: Date, horizonDays = 365): Generator<Placement> {
  for (let i = 0; i < horizonDays; i++) {
    const day = addMin(new Date(Date.UTC(fromUTC.getUTCFullYear(), fromUTC.getUTCMonth(), fromUTC.getUTCDate())), i * 24 * 60);
    if (isHoliday(input.holidays, day)) continue;
    for (const w of dailyWindows(input, day)) {
      if (w.end <= fromUTC) continue;
      const s = new Date(Math.max(w.start.getTime(), fromUTC.getTime()));
      yield { start: s, end: w.end };
    }
  }
}

/** Greedy placement within working windows */
function placeDuration(input: SchedulerInput, earliestUTC: Date, minutes: number): Placement[] {
  let left = Math.max(0, Math.ceil(minutes));
  const placed: Placement[] = [];
  let cursor = new Date(earliestUTC);

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

/** Next working start >= given UTC instant */
function nextWorkingStart(input: SchedulerInput, fromUTC: Date): Date {
  for (const w of iterWindows(input, fromUTC, 366)) return w.start;
  return fromUTC;
}

/** Main planner */
function planSchedule(input: SchedulerInput, baseStartUTC?: Date) {
  const jobs = input.jobs
    .filter(j => j.proof_approved_at)
    .map(j => ({ ...j, approvedAt: new Date(j.proof_approved_at!) }))
    .sort((a,b)=> a.approvedAt.getTime() - b.approvedAt.getTime());

  const resourceFree = new Map<UUID, Date>();
  const updates: Update[] = [];

  for (const job of jobs) {
    const stages = [...job.stages].sort((a,b)=>(a.stage_order ?? 9_999) - (b.stage_order ?? 9_999));
    const orders = Array.from(new Set(stages.map(s => s.stage_order ?? 9_999))).sort((a,b)=>a-b);
    const doneAt = new Map<UUID, Date>();

    for (const ord of orders) {
      for (const st of stages.filter(s => (s.stage_order ?? 9_999) === ord)) {
        const resource = st.production_stage_id;

        // earliest = max(approval, baseStart, predecessors, resourceFree)
        let earliest = new Date(job.approvedAt);
        if (baseStartUTC) earliest = new Date(Math.max(earliest.getTime(), baseStartUTC.getTime()));
        for (const prev of stages) {
          if ((prev.stage_order ?? 9_999) < (st.stage_order ?? 9_999)) {
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

/** Parse YYYY-MM-DD *as UTC midnight*, so it can never roll back a day in UTC */
function parseSeedDateUTC(d?: string): Date {
  if (!d) return new Date(); // now (UTC)
  // Force UTC midnight
  return new Date(`${d}T00:00:00Z`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const qp = (k: string, def: string) => (url.searchParams.get(k) ?? (body as any)[k] ?? def);

    const commit      = qp("commit", "true") === "true";
    const proposed    = qp("proposed", "false") === "true";
    const onlyIfUnset = qp("onlyIfUnset", "false") === "true";
    const nuclear     = qp("nuclear", "false") === "true";
    const startFrom   = qp("startFrom", "");              // "YYYY-MM-DD"
    const wipeAll     = qp("wipeAll", "false") === "true";

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL_INTERNAL");
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1) Snapshot
    const { data: snap, error: expErr } = await supabase.rpc("export_scheduler_input");
    if (expErr) throw new Error("export_scheduler_input failed: " + JSON.stringify(expErr));
    const input = snap as SchedulerInput;

    // 2) Compute nuclear base start (UTC) + clear
    let baseStartUTC: Date | undefined;
    let seedUTC: Date | undefined;

    if (nuclear) {
      seedUTC = parseSeedDateUTC(startFrom || new Date().toISOString().slice(0,10));
      baseStartUTC = nextWorkingStart(input, seedUTC);

      if (commit) {
        // Clear any auto times *from* the baseStart forward
        const { error: clearErr } = await supabase.rpc("unschedule_auto_stages", {
          from_date: baseStartUTC.toISOString().slice(0,10),
          wipe_all : wipeAll,
        });
        if (clearErr) throw new Error("unschedule_auto_stages failed: " + JSON.stringify(clearErr));
      }
    }

    // 3) Plan
    const { updates } = planSchedule(input, baseStartUTC);

    // 4) Apply + Mirror
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

      // IMPORTANT: mirror to the board table the UI reads
      const ids = updates.map(u => u.id);
      const { error: mirrorErr } = await supabase.rpc("mirror_jsi_to_stage_time_slots", { p_stage_ids: ids });
      if (mirrorErr) throw new Error("mirror_jsi_to_stage_time_slots failed: " + JSON.stringify(mirrorErr));
    }

    return new Response(JSON.stringify({
      ok: true,
      scheduled: updates.length,
      applied,
      seedUTC: seedUTC?.toISOString() ?? null,
      baseStartUTC: baseStartUTC?.toISOString() ?? null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
