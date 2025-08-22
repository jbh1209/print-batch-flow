// supabase/functions/scheduler-run/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type UUID = string;
type Interval = { start: Date; end: Date };

const MS = 60_000;
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * MS);
const floorToMinute = (d: Date) => new Date(Math.floor(d.getTime() / MS) * MS);

// Treat "YYYY-MM-DD" as a calendar date (no implicit UTC).
const parseLocalYmd = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
};

const parseClock = (t: string) => {
  const [h, m, s = "0"] = t.split(":");
  return { h: +h, m: +m, s: +s };
};

function isHoliday(holidays: { date: string; name: string }[], day: Date) {
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, "0");
  const d = String(day.getDate()).padStart(2, "0");
  return holidays.some((h) => h.date.startsWith(`${y}-${m}-${d}`));
}

function dailyWindows(input: any, day: Date): Interval[] {
  const dow = day.getDay(); // 0..6 (Sun..Sat)
  const todays = input.shifts.filter((s: any) => s.day_of_week === dow && s.is_working_day);
  const wins: Interval[] = [];
  for (const s of todays) {
    const st = parseClock(s.shift_start_time);
    const et = parseClock(s.shift_end_time);
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
        if (b1 <= g.start || b0 >= g.end) { next.push(g); continue; }
        if (g.start < b0) next.push({ start: g.start, end: b0 });
        if (b1 < g.end)   next.push({ start: b1, end: g.end });
      }
      segs = next;
    }
    wins.push(...segs);
  }
  return wins.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Iterate future work windows, clipped to "from". */
function* iterWindows(input: any, from: Date, horizonDays = 365): Generator<Interval> {
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
function nextWorkingStart(input: any, from: Date): Date {
  for (const w of iterWindows(input, from, 365)) return w.start;
  return floorToMinute(from);
}

/** Place minutes contiguously across windows (no gaps except non-working time). */
function placeDuration(input: any, earliest: Date, minutes: number): Interval[] {
  let left = Math.max(0, Math.ceil(minutes));
  const placed: Interval[] = [];
  let cursor = floorToMinute(earliest);
  for (const w of iterWindows(input, cursor)) {
    if (left <= 0) break;
    const available = Math.floor((w.end.getTime() - Math.max(w.start.getTime(), cursor.getTime())) / MS);
    const use = Math.min(available, left);
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

function planSchedule(input: any, baseStart?: Date) {
  const nowFloor = floorToMinute(new Date());
  const globalMin = baseStart ? baseStart : nextWorkingStart(input, nowFloor);

  const jobs = input.jobs
    .filter((j: any) => j.proof_approved_at)
    .map((j: any) => ({ ...j, approvedAt: new Date(j.proof_approved_at) }))
    .sort((a: any, b: any) => a.approvedAt.getTime() - b.approvedAt.getTime());

  const resourceFree = new Map<UUID, Date>();
  const updates: { id: UUID; start_at: string; end_at: string; minutes: number }[] = [];

  for (const job of jobs) {
    const stages = [...job.stages].sort((a: any, b: any) => (a.stage_order ?? 9999) - (b.stage_order ?? 9999));
    const orders = Array.from(new Set(stages.map((s: any) => s.stage_order ?? 9999))).sort((a, b) => a - b);
    const doneAt = new Map<UUID, Date>();

    for (const ord of orders) {
      for (const st of stages.filter((s: any) => (s.stage_order ?? 9999) === ord)) {
        const resource = st.production_stage_id;

        let earliest = new Date(Math.max(job.approvedAt.getTime(), globalMin.getTime()));
        for (const prev of stages) {
          if ((prev.stage_order ?? 9999) < (st.stage_order ?? 9999)) {
            const prevEnd = doneAt.get(prev.id as UUID);
            if (prevEnd && prevEnd > earliest) earliest = prevEnd;
          }
        }
        const free = resourceFree.get(resource);
        if (free && free > earliest) earliest = free;

        const mins = Math.max(0, Math.round((st.estimated_minutes ?? 0) + (st.setup_minutes ?? 0)));
        const segs = mins > 0 ? placeDuration(input, earliest, mins) : [{ start: earliest, end: earliest }];
        const start = segs[0].start, end = segs[segs.length - 1].end;

        updates.push({ id: st.id, start_at: start.toISOString(), end_at: end.toISOString(), minutes: mins });
        doneAt.set(st.id as UUID, end);
        resourceFree.set(resource, end);
      }
    }
  }
  return { updates };
}

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
    const startFrom   = qp("startFrom", "");           // optional
    const wipeAll     = qp("wipeAll", "false") === "true";

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL_INTERNAL");
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey)
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1) Snapshot
    const { data: snap, error: exportErr } = await supabase.rpc("export_scheduler_input");
    if (exportErr) throw new Error("export_scheduler_input failed: " + JSON.stringify(exportErr));
    const input = snap;

    // 2) Base start for nuclear reset (tomorrow unless a startFrom is explicitly provided)
    let baseStart: Date | undefined;
    if (nuclear) {
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
      const seed = startFrom ? parseLocalYmd(startFrom) : tomorrow;
      baseStart = nextWorkingStart(input, seed);

      if (commit) {
        const { error: clearErr } = await supabase.rpc("unschedule_auto_stages", {
          from_date: baseStart.toISOString().slice(0, 10),
          wipe_all: wipeAll,
        });
        if (clearErr) throw new Error("unschedule_auto_stages failed: " + JSON.stringify(clearErr));
      }
    }

    // 3) Plan (caps to >= baseStart or >= now’s next working minute)
    const { updates } = planSchedule(input, baseStart);

    // 4) Apply + mirror
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

      const ids = updates.map((u) => u.id);
      const { error: mirrorErr } = await supabase.rpc("mirror_jsi_to_stage_time_slots", { p_stage_ids: ids });
      if (mirrorErr) throw new Error("mirror_jsi_to_stage_time_slots failed: " + JSON.stringify(mirrorErr));
    }

    return new Response(JSON.stringify({ ok: true, scheduled: updates.length, applied, baseStart }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
