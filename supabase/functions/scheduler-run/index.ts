// supabase/functions/scheduler-run/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* -------------------- helpers -------------------- */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MS = 60_000;

const addMin = (d: Date, m: number) => new Date(d.getTime() + m * MS);

// accept boolean or "true"/"false"/"1"/"0"
const asBool = (v: unknown, def: boolean) => {
  if (v === undefined || v === null) return def;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase().trim();
  return s === "true" || s === "1";
};

const toInt = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : def;
};

const pickFirstNumber = (...vals: unknown[]) => {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
};

function parseClock(t: string) {
  // "HH:MM:SS" or "HH:MM"
  const [h, m, s = "0"] = t.split(":");
  return { h: +h, m: +m, s: +s };
}

function isHoliday(holidays: { date: string }[], day: Date) {
  const y = day.getFullYear();
  const mo = String(day.getMonth() + 1).padStart(2, "0");
  const d = String(day.getDate()).padStart(2, "0");
  return holidays.some((h) => h.date?.startsWith(`${y}-${mo}-${d}`));
}

type ShiftRow = {
  day_of_week: number; // 0=Sun..6=Sat OR 1=Mon..7=Sun; works either way
  is_working_day: boolean;
  shift_start_time: string; // "08:00:00"
  shift_end_time: string;   // "16:30:00"
};

type BreakRow = {
  start_time: string; // "12:30:00"
  minutes: number;
};

type Meta = {
  shifts: ShiftRow[];
  breaks: BreakRow[];
  holidays: { date: string }[];
};

function dailyWindows(meta: Meta, day: Date) {
  // support 0-based (Sun=0) or 1-based (Mon=1) DOW in your table
  const jsDow = day.getDay(); // 0..6 Sun..Sat
  const candidates = meta.shifts.filter((s) => {
    const dow1 = s.day_of_week;       // table value
    const dow0 = dow1 === 7 ? 0 : dow1; // convert 7->0 if present
    const normalized = dow1 > 6 ? dow0 : dow1; // (0..6) or already (0..6)
    return normalized === jsDow && s.is_working_day;
  });

  const wins: { start: Date; end: Date }[] = [];

  for (const s of candidates) {
    const st = parseClock(s.shift_start_time);
    const et = parseClock(s.shift_end_time);
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), st.h, st.m, +st.s);
    const end   = new Date(day.getFullYear(), day.getMonth(), day.getDate(), et.h, et.m, +et.s);
    if (end <= start) continue;

    // start with one window for the shift
    let segs: { start: Date; end: Date }[] = [{ start, end }];

    // subtract breaks if provided
    for (const br of meta.breaks ?? []) {
      const bt = parseClock(br.start_time);
      const b0 = new Date(day.getFullYear(), day.getMonth(), day.getDate(), bt.h, bt.m, +bt.s);
      const b1 = addMin(b0, toInt(br.minutes, 0));
      const next: typeof segs = [];
      for (const g of segs) {
        if (b1 <= g.start || b0 >= g.end) {
          next.push(g);
        } else {
          if (g.start < b0) next.push({ start: g.start, end: b0 });
          if (b1 < g.end)   next.push({ start: b1,    end: g.end });
        }
      }
      segs = next;
    }

    wins.push(...segs);
  }

  wins.sort((a, b) => a.start.getTime() - b.start.getTime());
  return wins;
}

function* iterWindows(meta: Meta, from: Date, horizonDays = 365) {
  for (let i = 0; i < horizonDays; i++) {
    const day = addMin(new Date(from.getFullYear(), from.getMonth(), from.getDate()), i * 24 * 60);
    if (isHoliday(meta.holidays, day)) continue;

    for (const w of dailyWindows(meta, day)) {
      if (w.end <= from) continue;
      const s = new Date(Math.max(w.start.getTime(), from.getTime()));
      yield { start: s, end: w.end };
    }
  }
}

function placeDuration(meta: Meta, earliest: Date, minutes: number) {
  let left = Math.max(0, Math.ceil(minutes));
  const placed: { start: Date; end: Date }[] = [];
  let cursor = new Date(earliest);

  for (const w of iterWindows(meta, cursor)) {
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

function nextWorkingStart(meta: Meta, from: Date) {
  for (const w of iterWindows(meta, from, 366)) return w.start;
  return from;
}

/* -------------------- main planner -------------------- */
type StageInput = {
  id: string;
  production_stage_id: string;
  stage_order?: number | null;
  // duration-ish fields (may or may not exist depending on your export)
  actual_duration_minutes?: number;
  actual_minutes?: number;
  estimated_duration_minutes?: number;
  estimated_minutes?: number;
  scheduled_minutes?: number;
  setup_time_minutes?: number;
  setup_minutes?: number;
};

type JobInput = {
  id: string;
  proof_approved_at?: string | null;
  stages: StageInput[];
};

type ExportPayload = {
  jobs: JobInput[];
  meta?: Partial<Meta>;
};

function planSchedule(meta: Meta, jobs: JobInput[], baseStart?: Date) {
  // order jobs by proof_approved_at
  const ordered = jobs
    .filter((j) => true) // allow all jobs; you can re-add proof gating if desired
    .map((j) => ({
      ...j,
      approvedAt: j.proof_approved_at ? new Date(j.proof_approved_at) : new Date(0),
    }))
    .sort((a, b) => a.approvedAt.getTime() - b.approvedAt.getTime());

  const resourceFree = new Map<string, Date>();
  const updates: { id: string; start_at: string; end_at: string; minutes: number }[] = [];

  for (const job of ordered) {
    const stages = [...job.stages].sort(
      (a, b) => (a.stage_order ?? 9999) - (b.stage_order ?? 9999)
    );

    // capture completion time per stage to chain same-order groups
    const doneAt = new Map<string, Date>();
    const orders = Array.from(new Set(stages.map((s) => s.stage_order ?? 9999))).sort((a, b) => a - b);

    for (const ord of orders) {
      for (const st of stages.filter((s) => (s.stage_order ?? 9999) === ord)) {
        const resource = st.production_stage_id;
        let earliest = job.approvedAt;
        if (baseStart) earliest = new Date(Math.max(earliest.getTime(), baseStart.getTime()));

        // chain after any earlier-order stage
        for (const prev of stages) {
          if ((prev.stage_order ?? 9999) < (st.stage_order ?? 9999)) {
            const end = doneAt.get(prev.id);
            if (end && end > earliest) earliest = end;
          }
        }
        const free = resourceFree.get(resource);
        if (free && free > earliest) earliest = free;

        // ----- robust minutes: actual > estimated > scheduled + setup -----
        const run = pickFirstNumber(
          st.actual_duration_minutes,
          st.actual_minutes,
          st.estimated_duration_minutes,
          st.estimated_minutes,
          st.scheduled_minutes
        );
        const setup = pickFirstNumber(st.setup_time_minutes, st.setup_minutes);

        const mins = Math.max(1, toInt(run + setup, 0)); // never NaN, never < 1

        const segs =
          mins > 0 ? placeDuration(meta, earliest, mins) : [{ start: earliest, end: earliest }];

        // If (for some reason) nothing placed, at least set a 1-minute block
        const start = segs.length ? segs[0].start : new Date(earliest);
        const end = segs.length ? segs[segs.length - 1].end : addMin(earliest, 1);

        updates.push({
          id: st.id,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          minutes: Math.max(mins, 1),
        });

        doneAt.set(st.id, end);
        resourceFree.set(resource, end);
      }
    }
  }

  return { updates };
}

/* -------------------- load meta directly from tables -------------------- */
async function loadMeta(supabase: ReturnType<typeof createClient>): Promise<Meta> {
  // shifts
  const { data: shifts, error: shiftsErr } = await supabase
    .from("shift_schedules")
    .select("day_of_week, is_working_day, shift_start_time, shift_end_time")
    .order("day_of_week", { ascending: true });

  if (shiftsErr) throw new Error("shift_schedules query failed: " + JSON.stringify(shiftsErr));
  const shiftRows: ShiftRow[] = (shifts ?? []) as any;

  // holidays (optional)
  let holidays: { date: string }[] = [];
  const { data: hol, error: holErr } = await supabase.from("public_holidays").select("date");
  if (!holErr && hol) holidays = hol as any;

  // breaks (optional table; if you add one later, wire it up here)
  const breaks: BreakRow[] = [];

  return { shifts: shiftRows, breaks, holidays };
}

/* -------------------- handler -------------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const qp = (k: string, def?: any) => (url.searchParams.get(k) ?? (body as any)[k] ?? def);

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

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1) Load jobs+stages via your export RPC
    const { data: snap, error: exportErr } = await supabase.rpc("export_scheduler_input");
    if (exportErr) throw new Error("export_scheduler_input failed: " + JSON.stringify(exportErr));
    const exportInput = snap as ExportPayload;

    // 2) Build meta directly from tables so we *strictly* respect shifts/holidays
    const meta = await loadMeta(supabase);

    // 3) Compute a base start date
    let baseStart: Date | undefined;
    let unscheduledFromDate: string | undefined;
    if (nuclear) {
      const seed = startFrom ? startFrom : addMin(new Date(), 24 * 60); // default tomorrow
      baseStart = nextWorkingStart(meta, seed);
      unscheduledFromDate = baseStart.toISOString().slice(0, 10);

      if (commit) {
        if (wipeAll) {
          const { error } = await supabase.rpc("unschedule_auto_stages", {
            from_date: unscheduledFromDate,
            wipe_all: true,
          });
          if (error) {
            // fallback to from_date only
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

    // 4) Plan
    const jobs = exportInput.jobs ?? [];
    const { updates } = planSchedule(meta, jobs, baseStart);

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
        unscheduledFromDate: unscheduledFromDate ?? null,
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
