// supabase/functions/scheduler-run/index.ts
// Schedules job_stage_instances using exact minutes from DB and working windows.
// - minutes = job_stage_instances.estimated_duration_minutes + setup_time_minutes
// - respects shift_schedules + public_holidays
// - handles timezone so 08:00 local (Africa/Johannesburg, UTC+2) is NOT shown as 10:00 on the board
// - supports nuclear (wipe + rebuild from next working day)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* -------------------- CORS (keeps browser console clean on errors) -------------------- */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

/* -------------------- Types we actually use -------------------- */
type UUID = string;

type ShiftRow = {
  day_of_week: number;            // 0=Sun ... 6=Sat
  shift_start_time: string;       // "08:00:00"
  shift_end_time: string;         // "16:30:00"
  is_working_day: boolean;
  is_active?: boolean | null;
};

type HolidayRow = { date: string; is_active?: boolean | null };

type JobExport = {
  job_id: UUID;
  proof_approved_at: string | null;
  stages: Array<{
    id: UUID;                     // job_stage_instances.id
    job_id: UUID;
    production_stage_id: UUID;
    stage_order: number | null;
    status?: string | null;
  }>;
};

type ExportSnapshot = {
  meta?: { breaks?: { start_time: string; minutes: number }[] } | null;
  shifts: ShiftRow[];
  holidays: HolidayRow[];
  jobs: JobExport[];
};

type MinutesMap = Map<UUID, number>; // stage_instance_id -> minutes to schedule

type Placement = { id: UUID; start_at: string; end_at: string; minutes: number };

/* -------------------- Small utils -------------------- */
const MS = 60_000;
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * MS);
const parseClock = (t: string) => { const [h, m, s = "0"] = t.split(":"); return { h:+h, m:+m, s:+s }; };

// boolean-ish query/body values -> boolean
const asBool = (v: unknown, def: boolean) => {
  if (v === undefined || v === null) return def;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase().trim();
  return s === "true" || s === "1";
};

// We’ll treat all shift times as **local Africa/Johannesburg** and store in DB as UTC.
// Set via env if you ever change; default +120 minutes (UTC+2).
const TZ_OFFSET_MIN = Number(Deno.env.get("TZ_OFFSET_MINUTES") ?? "120"); // +120 = Africa/Johannesburg

// Construct a Date that represents a LOCAL (Africa/Johannesburg) clock time and returns it as a UTC Date.
// Example: local 2025-08-25 08:00 → returns 2025-08-25 06:00Z (so the browser shows 08:00 in ZA).
function localUTC(y: number, m0: number, d: number, hh: number, mm: number, ss = 0) {
  const utc = new Date(Date.UTC(y, m0, d, hh, mm, ss));
  return addMin(utc, -TZ_OFFSET_MIN);
}

function sameYMD(d: Date) {
  return { y: d.getUTCFullYear(), m0: d.getUTCMonth(), d: d.getUTCDate() };
}

/* -------------------- Working windows -------------------- */
function isHoliday(holidays: HolidayRow[], dayUTC: Date) {
  const y = dayUTC.getUTCFullYear();
  const m = String(dayUTC.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dayUTC.getUTCDate()).padStart(2, "0");
  // holidays.date is assumed YYYY-MM-DD in local; compare by string prefix
  return holidays.some(h => (h.is_active ?? true) && h.date.startsWith(`${y}-${m}-${d}`));
}

function dayOfWeekLocal(dayUTC: Date): number {
  // Convert UTC midnight to local clock to decide the local weekday
  const local = addMin(dayUTC, TZ_OFFSET_MIN);
  return local.getUTCDay(); // 0..6 (Sun..Sat) in local sense
}

type Interval = { start: Date; end: Date };

function dailyWindows(snapshot: ExportSnapshot, dayUTC: Date): Interval[] {
  const wins: Interval[] = [];
  const dowLocal = dayOfWeekLocal(dayUTC);
  const todays = snapshot.shifts.filter(s => (s.is_active ?? true) && s.day_of_week === dowLocal && s.is_working_day);
  for (const s of todays) {
    const st = parseClock(s.shift_start_time);
    const et = parseClock(s.shift_end_time);
    if (et.h < st.h || (et.h === st.h && et.m <= st.m)) continue; // ignore invalid windows

    const { y, m0, d } = sameYMD(dayUTC);
    // build the window edges at **local** times then convert to UTC
    const start = localUTC(y, m0, d, st.h, st.m, +st.s);
    const end   = localUTC(y, m0, d, et.h, et.m, +et.s);
    if (end <= start) continue;

    // apply breaks (local)
    let segs: Interval[] = [{ start, end }];
    const breaks = snapshot.meta?.breaks ?? []; // e.g. [{start_time:"13:00:00", minutes:30}]
    for (const br of breaks) {
      const bt = parseClock(br.start_time);
      const b0 = localUTC(y, m0, d, bt.h, bt.m, +bt.s);
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
  wins.sort((a,b)=>a.start.getTime()-b.start.getTime());
  return wins;
}

function* iterWindows(snapshot: ExportSnapshot, fromUTC: Date, horizonDays=365): Generator<Interval> {
  // Iterate day by day in UTC-midnight steps (we only care about local windows inside each day)
  const day0 = new Date(Date.UTC(fromUTC.getUTCFullYear(), fromUTC.getUTCMonth(), fromUTC.getUTCDate()));
  for (let i=0;i<horizonDays;i++) {
    const dayUTC = addMin(day0, i*24*60);
    if (isHoliday(snapshot.holidays, dayUTC)) continue;
    for (const w of dailyWindows(snapshot, dayUTC)) {
      if (w.end <= fromUTC) continue;
      const start = new Date(Math.max(w.start.getTime(), fromUTC.getTime()));
      yield { start, end: w.end };
    }
  }
}

function placeDuration(snapshot: ExportSnapshot, earliestUTC: Date, minutes: number): Interval[] {
  let left = Math.max(0, Math.ceil(minutes));
  const placed: Interval[] = [];
  let cursor = new Date(earliestUTC);
  for (const w of iterWindows(snapshot, cursor)) {
    if (left<=0) break;
    const capMin = Math.floor((w.end.getTime() - Math.max(w.start.getTime(), cursor.getTime()))/MS);
    const use = Math.min(capMin, left);
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

function nextWorkingStart(snapshot: ExportSnapshot, seedUTC: Date): Date {
  for (const w of iterWindows(snapshot, seedUTC, 366)) return w.start;
  return seedUTC;
}

/* -------------------- Minutes source: job_stage_instances -------------------- */
// We only trust the per-stage minutes **as imported by your matrix parser**:
// minutes = COALESCE(estimated_duration_minutes, 0) + COALESCE(setup_time_minutes, 0)
async function loadMinutesMap(supabase: ReturnType<typeof createClient>): Promise<MinutesMap> {
  const map: MinutesMap = new Map();
  // pull only the columns we need
  const { data, error } = await supabase
    .from("job_stage_instances")
    .select("id, estimated_duration_minutes, setup_time_minutes")
    .limit(10000); // plenty; adjust if you expect more

  if (error) throw new Error("loadMinutesMap failed: " + JSON.stringify(error));

  for (const row of (data ?? [])) {
    const est = Number(row.estimated_duration_minutes ?? 0);
    const setup = Number(row.setup_time_minutes ?? 0);
    const mins = Math.max(0, Math.round(est + setup));
    map.set(row.id as UUID, mins);
  }
  return map;
}

/* -------------------- Core scheduling -------------------- */
function plan(snapshot: ExportSnapshot, minutesMap: MinutesMap, baseStartUTC?: Date): Placement[] {
  // Jobs: only those with approved proof
  const jobs = snapshot.jobs
    .filter(j => !!j.proof_approved_at)
    .map(j => ({ ...j, approvedAtUTC: new Date(j.proof_approved_at as string) }))
    .sort((a,b)=> a.approvedAtUTC.getTime() - b.approvedAtUTC.getTime());

  const updates: Placement[] = [];
  const resourceFree = new Map<UUID, Date>(); // production_stage_id -> next free UTC
  const doneAt = new Map<UUID, Date>();       // stage_instance_id -> end UTC (for internal chain)

  for (const job of jobs) {
    // Sort stages by explicit stage_order; keep ties parallel (same order can run simultaneously on different machines)
    const stages = [...job.stages].sort((a,b)=>(a.stage_order ?? 9999)-(b.stage_order ?? 9999));

    // We schedule **every** stage instance in the export (except clearly completed)
    for (const st of stages) {
      // Skip completed stages if export provided status
      if ((st as any).status === "completed") continue;

      const mins = minutesMap.get(st.id) ?? 0; // exact minutes from DB
      // earliest = max(approval, baseStart, predecessors end, resource free)
      let earliest = new Date(job.approvedAtUTC);
      if (baseStartUTC) earliest = new Date(Math.max(earliest.getTime(), baseStartUTC.getTime()));

      // chain predecessors (any stage with strictly smaller stage_order)
      for (const prev of stages) {
        const po = prev.stage_order ?? 9999;
        const so = st.stage_order ?? 9999;
        if (po < so) {
          const prevEnd = doneAt.get(prev.id);
          if (prevEnd && prevEnd > earliest) earliest = prevEnd;
        }
      }

      // resource availability (per production_stage_id)
      const freeAt = resourceFree.get(st.production_stage_id);
      if (freeAt && freeAt > earliest) earliest = freeAt;

      // place minutes inside windows; zero minutes => keep at earliest instant
      const segs = mins > 0 ? placeDuration(snapshot, earliest, mins) : [{ start: earliest, end: earliest }];
      const start = segs[0].start;
      const end   = segs[segs.length - 1].end;

      updates.push({ id: st.id, start_at: start.toISOString(), end_at: end.toISOString(), minutes: mins });

      doneAt.set(st.id, end);
      resourceFree.set(st.production_stage_id, end);
    }
  }

  return updates;
}

/* -------------------- HTTP handler -------------------- */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url  = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const qp = (k: string, def?: any) => url.searchParams.get(k) ?? (body as any)[k] ?? def;

    const commit      = asBool(qp("commit", true),  true);
    const proposed    = asBool(qp("proposed", false), false);
    const onlyIfUnset = asBool(qp("onlyIfUnset", true), true);
    const nuclear     = asBool(qp("nuclear", false), false);
    const wipeAll     = asBool(qp("wipeAll", false), false);
    const startFrom   = (qp("startFrom", "") as string) || "";

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL_INTERNAL");
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1) Export snapshot (shifts/holidays/jobs+stages) from your DB view
    const { data: snap, error: exportErr } = await supabase.rpc("export_scheduler_input");
    if (exportErr) throw new Error("export_scheduler_input failed: " + JSON.stringify(exportErr));
    const snapshot = (snap ?? {}) as ExportSnapshot;

    // Ensure we have at least a default lunch break if none was provided (13:00, 30m)
    if (!snapshot.meta) snapshot.meta = {};
    if (!snapshot.meta.breaks || snapshot.meta.breaks.length === 0) {
      snapshot.meta.breaks = [{ start_time: "13:00:00", minutes: 30 }];
    }

    // 2) Minutes map (exact minutes from job_stage_instances)
    const minutesMap = await loadMinutesMap(supabase);

    // 3) Determine base start for nuclear runs (next working day's first window)
    let baseStartUTC: Date | undefined;
    let unscheduledFromDate: string | null = null;

    if (nuclear) {
      const seed = startFrom
        ? new Date(startFrom + "T00:00:00Z")
        : new Date(); // now
      // shift seed to *local midnight* so "next working window" lands on the right day
      const localMidnightUTC = localUTC(seed.getUTCFullYear(), seed.getUTCMonth(), seed.getUTCDate(), 0, 0, 0);
      baseStartUTC = nextWorkingStart(snapshot, addMin(localMidnightUTC, 1)); // +1 minute to avoid boundary issues

      unscheduledFromDate = ((): string => {
        const d = addMin(baseStartUTC!, TZ_OFFSET_MIN); // turn UTC back into local date string
        const y = d.getUTCFullYear(), m = String(d.getUTCMonth()+1).padStart(2,"0"), day = String(d.getUTCDate()).padStart(2,"0");
        return `${y}-${m}-${day}`;
      })();

      if (commit) {
        // Try wide wipe if available; else plain from_date
        if (wipeAll) {
          const { error: w1 } = await supabase.rpc("unschedule_auto_stages", { from_date: unscheduledFromDate, wipe_all: true });
          if (w1) {
            const { error: w2 } = await supabase.rpc("unschedule_auto_stages", { from_date: unscheduledFromDate });
            if (w2) throw new Error("unschedule_auto_stages failed: " + JSON.stringify({ with_wipe_all: w1, fallback: w2 }));
          }
        } else {
          const { error: w } = await supabase.rpc("unschedule_auto_stages", { from_date: unscheduledFromDate });
          if (w) throw new Error("unschedule_auto_stages failed: " + JSON.stringify(w));
        }
      }
    }

    // 4) Plan placements
    const updates = plan(snapshot, minutesMap, baseStartUTC);

    // 5) Apply to DB
    let applied: unknown = { updated: 0 };
    if (commit && updates.length) {
      const { data, error } = await supabase.rpc("apply_stage_updates_safe", {
        updates, commit: true, only_if_unset: onlyIfUnset, as_proposed: proposed
      });
      if (error) throw new Error("apply_stage_updates_safe failed: " + JSON.stringify(error));
      applied = data;
    }

    // Return debug info so we can see tz and baseStart clearly
    return new Response(JSON.stringify({
      ok: true,
      scheduled: updates.length,
      applied,
      tz_offset_minutes: TZ_OFFSET_MIN,
      nuclear,
      startFrom: startFrom || null,
      baseStartUTC: baseStartUTC?.toISOString() ?? null,
      unscheduledFromDate
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
