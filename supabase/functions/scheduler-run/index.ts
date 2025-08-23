// supabase/functions/scheduler-run/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* -------------------- CORS -------------------- */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* -------------------- Time helpers -------------------- */
const MS = 60_000;
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * MS);
const parseClock = (t: string) => {
  const [h, m, s = "0"] = t.split(":");
  return { h: +h, m: +m, s: +s };
};

// accept boolean or "true"/"false"/"1"/"0"
const asBool = (v: any, def: boolean) => {
  if (v === undefined || v === null) return def;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase().trim();
  return s === "true" || s === "1";
};

// ---- Factory timezone (VERY IMPORTANT) ----
// Set this in your Supabase function env vars.
// e.g. FACTORY_TZ="Africa/Johannesburg"  (or your local zone)
const FACTORY_TZ = Deno.env.get("FACTORY_TZ") ?? "UTC";

// get the timezone offset in ms for a given UTC timestamp in a zone
function tzOffsetMs(tz: string, utcMillis: number) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(utcMillis));
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  const asUTC = Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour, +map.minute, +map.second);
  return asUTC - utcMillis;
}

/**
 * Convert a *factory wall time* (y,m,d,h,mi,s) into the UTC instant that
 * corresponds to that local time in FACTORY_TZ.
 * Month is JS 0-based (use date.getMonth()).
 */
function zonedTimeToUtc(y: number, m: number, d: number, h = 0, mi = 0, s = 0) {
  const guess = Date.UTC(y, m, d, h, mi, s);
  const off = tzOffsetMs(FACTORY_TZ, guess);
  return new Date(guess - off);
}

/* -------------------- Workday helpers -------------------- */
function isHoliday(holidays: any[], day: Date) {
  const y = day.getUTCFullYear();
  const m = String(day.getUTCMonth() + 1).padStart(2, "0");
  const d = String(day.getUTCDate()).padStart(2, "0");
  return holidays.some((h) => h.date.startsWith(`${y}-${m}-${d}`));
}

/**
 * Build all working windows for a *factory* day.
 * NOTE: We construct the window edges in FACTORY_TZ and convert to UTC so
 * they display at the intended local wall time.
 */
function dailyWindows(input: any, factoryDayUTC: Date) {
  // Build a "factory day" calendar using FACTORY_TZ components
  // Find the factory DOW for this UTC midnight
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: FACTORY_TZ,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = dtf.formatToParts(factoryDayUTC);
  const parts: Record<string, string> = {};
  for (const x of p) if (x.type !== "literal") parts[x.type] = x.value;

  // Reconstruct factory Y-M-D
  const fy = +parts.year;
  const fm = +parts.month - 1; // JS month
  const fd = +parts.day;

  // DOW (0=Sunday..6=Saturday) in the *factory* zone
  const dow = new Date(zonedTimeToUtc(fy, fm, fd, 12, 0, 0)).getUTCDay();

  // shifts for this factory DOW
  const todays = input.shifts.filter((s: any) => s.day_of_week === dow && s.is_working_day);

  const wins: Array<{ start: Date; end: Date }> = [];
  for (const s of todays) {
    const st = parseClock(s.shift_start_time);
    const et = parseClock(s.shift_end_time);

    const start = zonedTimeToUtc(fy, fm, fd, st.h, st.m, +st.s);
    const end = zonedTimeToUtc(fy, fm, fd, et.h, et.m, +et.s);
    if (end <= start) continue;

    // cut out breaks (also created in factory local time)
    let segs: Array<{ start: Date; end: Date }> = [{ start, end }];
    for (const br of input.meta.breaks ?? []) {
      const bt = parseClock(br.start_time);
      const b0 = zonedTimeToUtc(fy, fm, fd, bt.h, bt.m, +bt.s);
      const b1 = addMin(b0, br.minutes);

      const next: typeof segs = [];
      for (const g of segs) {
        if (b1 <= g.start || b0 >= g.end) next.push(g);
        else {
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

/**
 * Iterate all windows from a given UTC instant, stepping by factory days.
 */
function* iterWindows(input: any, fromUTC: Date, horizonDays = 365) {
  // Find the factory midnight (00:00) for the day that contains `fromUTC`
  const ftParts = new Intl.DateTimeFormat("en-US", {
    timeZone: FACTORY_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fromUTC);
  const map: Record<string, string> = {};
  for (const p of ftParts) if (p.type !== "literal") map[p.type] = p.value;
  const fy = +map.year;
  const fm = +map.month - 1;
  const fd = +map.day;

  // factory midnight of that day, in UTC
  let factoryMidnightUTC = zonedTimeToUtc(fy, fm, fd, 0, 0, 0);

  for (let i = 0; i < horizonDays; i++) {
    const dayUTC = addMin(factoryMidnightUTC, i * 24 * 60);
    if (isHoliday(input.holidays, dayUTC)) continue;

    for (const w of dailyWindows(input, dayUTC)) {
      if (w.end <= fromUTC) continue;
      const s = new Date(Math.max(w.start.getTime(), fromUTC.getTime()));
      yield { start: s, end: w.end };
    }
  }
}

/** Place a duration across working windows (UTC instants) */
function placeDuration(input: any, earliestUTC: Date, minutes: number) {
  let left = Math.max(0, Math.ceil(minutes));
  const placed: Array<{ start: Date; end: Date }> = [];
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

function nextWorkingStart(input: any, fromUTC: Date) {
  for (const w of iterWindows(input, fromUTC, 365)) return w.start;
  return fromUTC;
}

/* -------------------- Planning -------------------- */
function planSchedule(input: any, baseStartUTC: Date | null) {
  // Only approved jobs, oldest first
  const jobs = input.jobs
    .filter((j: any) => j.proof_approved_at)
    .map((j: any) => ({ ...j, approvedAt: new Date(j.proof_approved_at) }))
    .sort((a: any, b: any) => a.approvedAt.getTime() - b.approvedAt.getTime());

  const resourceFree = new Map<string, Date>(); // production_stage_id -> next free UTC instant
  const updates: Array<{ id: string; start_at: string; end_at: string; minutes: number }> = [];

  for (const job of jobs) {
    const stages = [...job.stages].sort(
      (a: any, b: any) => (a.stage_order ?? 9999) - (b.stage_order ?? 9999)
    );
    const orders = Array.from(new Set(stages.map((s: any) => s.stage_order ?? 9999))).sort(
      (a, b) => a - b
    );

    const doneAt = new Map<string, Date>(); // stage_instance_id -> end UTC

    for (const ord of orders) {
      for (const st of stages.filter((s: any) => (s.stage_order ?? 9999) === ord)) {
        const resource = st.production_stage_id;

        // earliest = max(approved, baseStart (if any), all deps finished, resource free)
        let earliest = job.approvedAt;
        if (baseStartUTC) earliest = new Date(Math.max(earliest.getTime(), baseStartUTC.getTime()));

        for (const prev of stages) {
          if ((prev.stage_order ?? 9999) < (st.stage_order ?? 9999)) {
            const end = doneAt.get(prev.id);
            if (end && end > earliest) earliest = end;
          }
        }
        const free = resourceFree.get(resource);
        if (free && free > earliest) earliest = free;

        // exact minutes from DB: estimated + setup
        const mins = Math.max(
          0,
          Math.round((st.estimated_duration_minutes || 0) + (st.setup_time_minutes || 0))
        );

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

/* -------------------- HTTP handler -------------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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
    if (exportErr)
      throw new Error("export_scheduler_input failed: " + JSON.stringify(exportErr));
    const input = snap;

    // 2) Nuclear: base start computed in FACTORY_TZ, then wipe
    let baseStart: Date | null = null;
    let unscheduledFromDate: string | null = null;

    if (nuclear) {
      // default to “tomorrow at factory midnight”, then shift to first working window
      const seedLocal = startFrom
        ? startFrom
        : addMin(new Date(), 24 * 60); // tomorrow date
      const fy = seedLocal.getUTCFullYear();
      const fm = seedLocal.getUTCMonth();
      const fd = seedLocal.getUTCDate();

      const seedUTC = zonedTimeToUtc(fy, fm, fd, 0, 0, 0);
      baseStart = nextWorkingStart(input, seedUTC);

      unscheduledFromDate = baseStart.toISOString().slice(0, 10); // YYYY-MM-DD
      if (commit) {
        if (wipeAll) {
          const { error } = await supabase.rpc("unschedule_auto_stages", {
            from_date: unscheduledFromDate,
            wipe_all: true,
          });
          if (error) {
            const { error: e2 } = await supabase.rpc("unschedule_auto_stages", {
              from_date: unscheduledFromDate,
            });
            if (e2)
              throw new Error(
                "unschedule_auto_stages failed (wipe_all + fallback): " +
                  JSON.stringify({ with_wipe_all: error, fallback: e2 })
              );
          }
        } else {
          const { error } = await supabase.rpc("unschedule_auto_stages", {
            from_date: unscheduledFromDate,
          });
          if (error) throw new Error("unschedule_auto_stages failed: " + JSON.stringify(error));
        }
      }
    }

    // 3) Plan (with exact minutes & factory-TZ windows)
    const { updates } = planSchedule(input, baseStart);

    // 4) Apply & mirror
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
        throw new Error(
          "mirror_jsi_to_stage_time_slots failed: " + JSON.stringify(mirrorErr)
        );
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
        factoryTz: FACTORY_TZ,
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
