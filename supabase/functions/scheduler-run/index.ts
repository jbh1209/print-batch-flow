// supabase/functions/scheduler-run/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* -------------------- CORS -------------------- */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* -------------------- time helpers -------------------- */
const MS = 60_000;
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * MS);

const parseClock = (t: string) => {
  const [h, m, s = "0"] = t.split(":");
  return { h: +h, m: +m, s: +s };
};

// accept boolean or "true"/"false"/"1"/"0"
const asBool = (v: unknown, def: boolean) => {
  if (v === undefined || v === null) return def;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase().trim();
  return s === "true" || s === "1";
};

/* -------------------- calendar helpers -------------------- */
function isHoliday(holidays: Array<{ date: string }>, day: Date) {
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, "0");
  const d = String(day.getDate()).padStart(2, "0");
  return holidays.some((h) => h.date.startsWith(`${y}-${m}-${d}`));
}

function dailyWindows(input: any, day: Date) {
  const dow = day.getDay();
  const todays = (input.shifts ?? []).filter(
    (s: any) => s.day_of_week === dow && s.is_working_day
  );

  const wins: Array<{ start: Date; end: Date }> = [];

  for (const s of todays) {
    const st = parseClock(s.shift_start_time);
    const et = parseClock(s.shift_end_time);

    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), st.h, st.m, +st.s);
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), et.h, et.m, +et.s);
    if (end <= start) continue;

    // carve out breaks
    let segs: Array<{ start: Date; end: Date }> = [{ start, end }];
    for (const br of input.meta?.breaks ?? []) {
      const bt = parseClock(br.start_time);
      const b0 = new Date(day.getFullYear(), day.getMonth(), day.getDate(), bt.h, bt.m, +bt.s);
      const b1 = addMin(b0, br.minutes);
      const next: typeof segs = [];
      for (const g of segs) {
        if (b1 <= g.start || b0 >= g.end) {
          next.push(g);
        } else {
          if (g.start < b0) next.push({ start: g.start, end: b0 });
          if (b1 < g.end) next.push({ start: b1, end: g.end });
        }
      }
      segs = next;
    }

    wins.push(...segs);
  }

  return wins.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function* iterWindows(input: any, from: Date, horizonDays = 365) {
  for (let i = 0; i < horizonDays; i++) {
    const day = addMin(new Date(from.getFullYear(), from.getMonth(), from.getDate()), i * 24 * 60);
    if (isHoliday(input.holidays ?? [], day)) continue;
    for (const w of dailyWindows(input, day)) {
      if (w.end <= from) continue;
      const s = new Date(Math.max(w.start.getTime(), from.getTime()));
      yield { start: s, end: w.end };
    }
  }
}

function placeDuration(input: any, earliest: Date, minutes: number) {
  let left = Math.max(0, Math.ceil(minutes));
  const placed: Array<{ start: Date; end: Date }> = [];
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

function nextWorkingStart(input: any, from: Date) {
  for (const w of iterWindows(input, from, 365)) return w.start;
  return from;
}

/* -------------------- minutes sourcing -------------------- */
/**
 * Pull minute columns for all stage IDs so we don’t depend on what the export RPC includes.
 */
async function fetchMinutesMap(supabase: any, stageIds: string[]) {
  const map = new Map<
    string,
    {
      estimated_duration_minutes: number | null;
      setup_time_minutes: number | null;
      actual_duration_minutes: number | null;
      scheduled_minutes: number | null;
    }
  >();

  if (!stageIds.length) return map;

  // chunk the IN() to be safe (~1000 ids per chunk)
  const chunkSize = 900;
  for (let i = 0; i < stageIds.length; i += chunkSize) {
    const chunk = stageIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("job_stage_instances")
      .select(
        "id, estimated_duration_minutes, setup_time_minutes, actual_duration_minutes, scheduled_minutes"
      )
      .in("id", chunk);

    if (error) throw new Error("minutes lookup failed: " + JSON.stringify(error));
    for (const row of data ?? []) {
      map.set(row.id, {
        estimated_duration_minutes: row.estimated_duration_minutes,
        setup_time_minutes: row.setup_time_minutes,
        actual_duration_minutes: row.actual_duration_minutes,
        scheduled_minutes: row.scheduled_minutes,
      });
    }
  }

  return map;
}

function minutesFrom(source: any) {
  // Prefer estimated + setup, then actual + setup, then scheduled
  const est =
    source.estimated_duration_minutes ??
    source.estimated_minutes ??
    null; // support old names if ever present
  const setup = source.setup_time_minutes ?? source.setup_minutes ?? 0;
  const actual = source.actual_duration_minutes ?? null;
  const scheduled = source.scheduled_minutes ?? null;

  const estPlusSetup =
    (est ?? 0) + (setup ?? 0); // if est is null, becomes setup only (0 if setup also null)
  if (est != null && estPlusSetup > 0) return estPlusSetup;

  const actPlusSetup = (actual ?? 0) + (setup ?? 0);
  if (actual != null && actPlusSetup > 0) return actPlusSetup;

  if (scheduled != null) return scheduled;

  // last resort
  return 0;
}

/* -------------------- planner -------------------- */
function planSchedule(input: any, baseStart: Date | null, minutesMap: Map<string, any>) {
  const jobs = (input.jobs ?? [])
    .filter((j: any) => j.proof_approved_at)
    .map((j: any) => ({ ...j, approvedAt: new Date(j.proof_approved_at) }))
    .sort((a: any, b: any) => a.approvedAt.getTime() - b.approvedAt.getTime());

  const resourceFree = new Map<string, Date>();
  const updates: Array<{ id: string; start_at: string; end_at: string; minutes: number }> = [];

  for (const job of jobs) {
    const stages = [...(job.stages ?? [])].sort(
      (a: any, b: any) => (a.stage_order ?? 9999) - (b.stage_order ?? 9999)
    );
    const orders = Array.from(new Set(stages.map((s: any) => s.stage_order ?? 9999))).sort(
      (a, b) => a - b
    );

    const doneAt = new Map<string, Date>();

    for (const ord of orders) {
      for (const st of stages.filter((s: any) => (s.stage_order ?? 9999) === ord)) {
        const resource = st.production_stage_id as string;

        // earliest considering job approval, baseStart, predecessors and resource
        let earliest = job.approvedAt as Date;
        if (baseStart) earliest = new Date(Math.max(earliest.getTime(), baseStart.getTime()));

        for (const prev of stages) {
          if ((prev.stage_order ?? 9999) < (st.stage_order ?? 9999)) {
            const end = doneAt.get(prev.id);
            if (end && end > earliest) earliest = end;
          }
        }

        const free = resourceFree.get(resource);
        if (free && free > earliest) earliest = free;

        // minutes: from DB map first, otherwise from the stage payload if present
        const mRow = minutesMap.get(st.id) ?? st;
        const mins = Math.max(0, Math.round(minutesFrom(mRow)));

        const segs =
          mins > 0
            ? placeDuration(input, earliest, mins)
            : [{ start: earliest, end: earliest }];

        const start = segs[0].start;
        const end = segs[segs.length - 1].end;

        updates.push({
          id: st.id,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          minutes: mins,
        });

        doneAt.set(st.id, end);
        resourceFree.set(resource, end);
      }
    }
  }

  return { updates };
}

/* -------------------- handler -------------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    const qp = (k: string, def?: any) => url.searchParams.get(k) ?? (body as any)[k] ?? def;

    const commit = asBool(qp("commit", true), true);
    const proposed = asBool(qp("proposed", false), false);
    const onlyIfUnset = asBool(qp("onlyIfUnset", true), true);
    const nuclear = asBool(qp("nuclear", false), false);
    const wipeAll = asBool(qp("wipeAll", false), false);

    const startFromStr = String(qp("startFrom", "") ?? "");
    const startFrom = startFromStr ? new Date(startFromStr) : null;

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL_INTERNAL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1) Export snapshot
    const { data: snap, error: exportErr } = await supabase.rpc("export_scheduler_input");
    if (exportErr) throw new Error("export_scheduler_input failed: " + JSON.stringify(exportErr));
    const input = snap;

    // 2) Determine base start + optionally wipe existing auto schedule
    let baseStart: Date | null = null;
    let unscheduledFromDate: string | null = null;

    if (nuclear) {
      const seed = startFrom ? startFrom : addMin(new Date(), 24 * 60); // default: tomorrow
      baseStart = nextWorkingStart(input, seed);
      unscheduledFromDate = baseStart.toISOString().slice(0, 10);

      if (commit) {
        if (wipeAll) {
          // Two-arity version (from_date, wipe_all) – if your DB only has (from_date), just call that one
          const { error } = await supabase.rpc("unschedule_auto_stages", {
            from_date: unscheduledFromDate,
            wipe_all: true,
          });
          if (error) {
            // try 1-arity as a fallback
            const { error: e2 } = await supabase.rpc("unschedule_auto_stages", {
              from_date: unscheduledFromDate,
            });
            if (e2) {
              throw new Error(
                "unschedule_auto_stages failed (wipe_all + fallback): " +
                  JSON.stringify({ with_wipe_all: error, fallback: e2 })
              );
            }
          }
        } else {
          const { error } = await supabase.rpc("unschedule_auto_stages", {
            from_date: unscheduledFromDate,
          });
          if (error) throw new Error("unschedule_auto_stages failed: " + JSON.stringify(error));
        }
      }
    }

    // 3) Build a minutes map so we always use the true per-stage minutes
    const allStageIds: string[] = [];
    for (const j of input.jobs ?? []) for (const s of j.stages ?? []) allStageIds.push(s.id);
    const minutesMap = await fetchMinutesMap(supabase, allStageIds);

    // 4) Plan
    const { updates } = planSchedule(input, baseStart, minutesMap);

    // 5) Apply + mirror
    let applied: any = { updated: 0 };
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
      const { error: mirrorErr } = await supabase.rpc("mirror_jsi_to_stage_time_slots", {
        p_stage_ids: ids,
      });
      if (mirrorErr)
        throw new Error("mirror_jsi_to_stage_time_slots failed: " + JSON.stringify(mirrorErr));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        scheduled: updates.length,
        applied,
        nuclear,
        startFrom: startFromStr || null,
        baseStart: baseStart?.toISOString() ?? null,
        unscheduledFromDate,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
