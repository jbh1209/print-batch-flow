// supabase/functions/scheduler-run/index.ts
// Robust scheduler: pulls authoritative minutes from job_stage_instances,
// respects shifts & holidays, and writes plan back to DB.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* -------------------- CORS & helpers -------------------- */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MS = 60_000;
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * MS);
const asBool = (v: any, def: boolean) => {
  if (v === undefined || v === null) return def;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase().trim();
  return s === "true" || s === "1";
};
const parseClock = (t: string) => {
  const [h, m, s = "0"] = (t || "0:0:0").split(":");
  return { h: +h, m: +m, s: +s };
};
const toInt = (v: any, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : def;
};
const firstPositive = (...vals: any[]) => {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return 0;
};

/* -------------------- types -------------------- */
type ShiftRow = {
  day_of_week: number; // 0..6 (Sun..Sat)
  is_working_day: boolean;
  shift_start_time: string; // "08:00:00"
  shift_end_time: string;   // "16:30:00"
};

type MinutesRow = {
  id: string;
  actual_duration_minutes?: number | null;
  actual_minutes?: number | null;
  estimated_duration_minutes?: number | null;
  estimated_minutes?: number | null;
  scheduled_minutes?: number | null;
  setup_time_minutes?: number | null;
  setup_minutes?: number | null;
};

/* -------------------- DB loaders -------------------- */
async function loadShifts(supabase: any): Promise<ShiftRow[]> {
  const { data, error } = await supabase
    .from("shift_schedules")
    .select("day_of_week,is_working_day,shift_start_time,shift_end_time")
    .order("day_of_week", { ascending: true });

  if (error || !data || !data.length) {
    // Default Mon–Fri 08:00–16:30
    const def: ShiftRow[] = [];
    for (let dow = 0; dow < 7; dow++) {
      if (dow >= 1 && dow <= 5) {
        def.push({
          day_of_week: dow,
          is_working_day: true,
          shift_start_time: "08:00:00",
          shift_end_time: "16:30:00",
        });
      } else {
        def.push({
          day_of_week: dow,
          is_working_day: false,
          shift_start_time: "00:00:00",
          shift_end_time: "00:00:00",
        });
      }
    }
    if (error) console.warn("shift_schedules fallback:", error);
    return def;
  }
  return data.map((r: any) => ({
    day_of_week: toInt(r.day_of_week, 0),
    is_working_day: !!r.is_working_day,
    shift_start_time: String(r.shift_start_time ?? "08:00:00"),
    shift_end_time: String(r.shift_end_time ?? "16:30:00"),
  }));
}

async function loadHolidays(supabase: any): Promise<string[]> {
  const { data, error } = await supabase.from("public_holidays").select("*");
  if (error || !data) {
    if (error) console.warn("public_holidays: ignoring; ", error);
    return [];
  }
  const dates: string[] = [];
  for (const r of data as any[]) {
    const d =
      r.date ?? r.holiday_date ?? r.holiday ?? r.holidayDate ?? null;
    if (d) {
      const s = String(d).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) dates.push(s);
    }
  }
  return dates;
}

function isHoliday(holidayDates: string[], day: Date) {
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, "0");
  const d = String(day.getDate()).padStart(2, "0");
  return holidayDates.includes(`${y}-${m}-${d}`);
}

/* -------------------- windows -------------------- */
function dailyWindows(shifts: ShiftRow[], day: Date) {
  const dow = day.getDay();
  const todays = shifts.filter(
    (s) => toInt(s.day_of_week, 0) === dow && !!s.is_working_day
  );
  const wins: { start: Date; end: Date }[] = [];
  for (const s of todays) {
    const st = parseClock(s.shift_start_time);
    const et = parseClock(s.shift_end_time);
    const start = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      st.h,
      st.m,
      +st.s
    );
    const end = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      et.h,
      et.m,
      +et.s
    );
    if (end > start) wins.push({ start, end });
  }
  return wins.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function* iterWindows(
  shifts: ShiftRow[],
  holidays: string[],
  from: Date,
  horizonDays = 365
) {
  for (let i = 0; i < horizonDays; i++) {
    const day = addMin(
      new Date(from.getFullYear(), from.getMonth(), from.getDate()),
      i * 24 * 60
    );
    if (isHoliday(holidays, day)) continue;
    for (const w of dailyWindows(shifts, day)) {
      if (w.end <= from) continue;
      const s = new Date(Math.max(w.start.getTime(), from.getTime()));
      yield { start: s, end: w.end };
    }
  }
}

function nextWorkingStart(shifts: ShiftRow[], holidays: string[], from: Date) {
  for (const w of iterWindows(shifts, holidays, from, 365)) return w.start;
  return from;
}

function placeDuration(
  shifts: ShiftRow[],
  holidays: string[],
  earliest: Date,
  minutes: number
) {
  let left = Math.max(1, Math.ceil(minutes));
  const placed: { start: Date; end: Date }[] = [];
  let cursor = new Date(earliest);
  for (const w of iterWindows(shifts, holidays, cursor)) {
    if (left <= 0) break;
    const cap = Math.floor(
      (w.end.getTime() - Math.max(w.start.getTime(), cursor.getTime())) / MS
    );
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

/* -------------------- export & minutes map -------------------- */
async function exportInput(supabase: any) {
  const { data, error } = await supabase.rpc("export_scheduler_input");
  if (error)
    throw new Error("export_scheduler_input failed: " + JSON.stringify(error));
  return data;
}

async function loadMinutesMap(supabase: any, stageIds: string[]) {
  if (!stageIds.length) return new Map<string, MinutesRow>();
  const { data, error } = await supabase
    .from("job_stage_instances")
    .select(
      "id, actual_duration_minutes, actual_minutes, estimated_duration_minutes, estimated_minutes, scheduled_minutes, setup_time_minutes, setup_minutes"
    )
    .in("id", stageIds);
  if (error) throw new Error("loadMinutesMap failed: " + JSON.stringify(error));
  const map = new Map<string, MinutesRow>();
  for (const r of (data || []) as MinutesRow[]) map.set(r.id, r);
  return map;
}

/* -------------------- planning -------------------- */
function planSchedule(
  input: any,
  shifts: ShiftRow[],
  holidays: string[],
  baseStart: Date | null,
  minutesMap: Map<string, MinutesRow>
) {
  const jobs = (input.jobs || [])
    .filter((j: any) => j.proof_approved_at)
    .map((j: any) => ({ ...j, approvedAt: new Date(j.proof_approved_at) }))
    .sort((a: any, b: any) => a.approvedAt.getTime() - b.approvedAt.getTime());

  const updates: Array<{
    id: string;
    start_at: string;
    end_at: string;
    minutes: number;
    scheduled_minutes: number; // some RPCs expect this key
  }> = [];

  const resourceFree = new Map<string, Date>();

  for (const job of jobs) {
    const stages = [...(job.stages || [])].sort(
      (a, b) => (a.stage_order ?? 9999) - (b.stage_order ?? 9999)
    );
    const orders = Array.from(
      new Set(stages.map((s: any) => s.stage_order ?? 9999))
    ).sort((a, b) => a - b);

    const doneAt = new Map<string, Date>();

    for (const ord of orders) {
      for (const st of stages.filter(
        (s: any) => (s.stage_order ?? 9999) === ord
      )) {
        const resource = String(st.production_stage_id);

        let earliest = job.approvedAt;
        if (baseStart) earliest = new Date(Math.max(earliest.getTime(), baseStart.getTime()));

        // stage dependencies
        for (const prev of stages) {
          if ((prev.stage_order ?? 9999) < (st.stage_order ?? 9999)) {
            const d = doneAt.get(prev.id);
            if (d && d > earliest) earliest = d;
          }
        }

        // resource availability
        const rf = resourceFree.get(resource);
        if (rf && rf > earliest) earliest = rf;

        // minutes from DB authoritative map
        const row = minutesMap.get(st.id);
        const run = firstPositive(
          row?.actual_duration_minutes,
          row?.actual_minutes,
          row?.estimated_duration_minutes,
          row?.estimated_minutes,
          row?.scheduled_minutes
        );
        const setup = firstPositive(row?.setup_time_minutes, row?.setup_minutes);
        const mins = Math.max(1, toInt(run + setup, 0));

        // place across windows
        const segs =
          mins > 0 ? placeDuration(shifts, holidays, earliest, mins) : [];
        if (!segs.length) {
          const s = nextWorkingStart(shifts, holidays, earliest);
          const e = addMin(s, 1);
          updates.push({
            id: st.id,
            start_at: s.toISOString(),
            end_at: e.toISOString(),
            minutes: 1,
            scheduled_minutes: 1,
          });
          doneAt.set(st.id, e);
          resourceFree.set(resource, e);
          continue;
        }

        const start = segs[0].start;
        const end = segs[segs.length - 1].end;

        updates.push({
          id: st.id,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          minutes: mins,
          scheduled_minutes: mins,
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
    const body =
      req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const qp = (k: string, d: any) =>
      url.searchParams.get(k) ?? (body as any)[k] ?? d;

    const commit = asBool(qp("commit", true), true);
    const proposed = asBool(qp("proposed", false), false);
    const onlyIfUnset = asBool(qp("onlyIfUnset", true), true);
    const nuclear = asBool(qp("nuclear", true), true);
    const wipeAll = asBool(qp("wipeAll", true), true);
    const startFromStr = String(qp("startFrom", "") ?? "");
    const startFrom = startFromStr ? new Date(startFromStr) : null;

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL_INTERNAL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({
          error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 0) calendar
    const [shifts, holidays] = await Promise.all([
      loadShifts(supabase),
      loadHolidays(supabase),
    ]);

    // 1) export snapshot
    const snap = await exportInput(supabase);

    // 2) minutes map from DB (authoritative)
    const stageIds: string[] = [];
    for (const j of snap?.jobs ?? []) {
      for (const s of j?.stages ?? []) stageIds.push(s.id);
    }
    const minutesMap = await loadMinutesMap(supabase, stageIds);

    // 3) base start & wipe
    let baseStart: Date | null = null;
    let unscheduledFromDate: string | null = null;
    if (nuclear) {
      const seed = startFrom ? startFrom : addMin(new Date(), 24 * 60);
      baseStart = nextWorkingStart(shifts, holidays, seed);
      unscheduledFromDate = baseStart.toISOString().slice(0, 10);
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
          if (error)
            throw new Error(
              "unschedule_auto_stages failed: " + JSON.stringify(error)
            );
        }
      }
    }

    // 4) plan (real minutes + shifts)
    const { updates } = planSchedule(
      snap,
      shifts,
      holidays,
      baseStart,
      minutesMap
    );

    // 5) apply & mirror
    let applied: any = { updated: 0 };
    if (commit && updates.length) {
      const { data, error } = await supabase.rpc("apply_stage_updates_safe", {
        updates,                 // contains id, start_at, end_at, minutes, scheduled_minutes
        commit: true,
        only_if_unset: onlyIfUnset,
        as_proposed: proposed,
      });
      if (error)
        throw new Error(
          "apply_stage_updates_safe failed: " + JSON.stringify(error)
        );
      applied = data;

      const ids = updates.map((u) => u.id);
      const { error: mirrorErr } = await supabase.rpc(
        "mirror_jsi_to_stage_time_slots",
        { p_stage_ids: ids }
      );
      if (mirrorErr)
        throw new Error(
          "mirror_jsi_to_stage_time_slots failed: " + JSON.stringify(mirrorErr)
        );
    }

    // small debug sample so we can confirm minutes immediately
    const debugSample = updates.slice(0, 8).map((u) => ({
      id: u.id,
      minutes: u.minutes,
      start: u.start_at,
      end: u.end_at,
    }));

    return new Response(
      JSON.stringify({
        ok: true,
        scheduled: updates.length,
        applied,
        nuclear,
        startFrom: startFromStr || null,
        baseStart: baseStart?.toISOString() ?? null,
        unscheduledFromDate,
        debugSample,
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
