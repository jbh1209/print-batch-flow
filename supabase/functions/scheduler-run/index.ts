// supabase/functions/scheduler-run/index.ts
// Schedules job stage instances across working shifts and writes exact minutes.
// No custom RPCs; reads/writes directly with the service role.
//
// Tables relied on:
// - public.job_stage_instances
// - public.stage_time_slots
// - public.shift_schedules (day_of_week, is_working_day, shift_start_time, shift_end_time)
// - public.public_holidays (date)
//
// Conflict key assumed on stage_time_slots: (production_stage_id, slot_start_time)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ShiftRow = {
  day_of_week: number; // 0=Sunday..6=Saturday
  is_working_day: boolean;
  shift_start_time: string; // '08:00:00'
  shift_end_time: string;   // '16:30:00'
};

type HolidayRow = { date: string };

type JSI = {
  id: string;
  job_id: string;
  production_stage_id: string;
  stage_order: number | null;

  actual_duration_minutes: number | null;
  estimated_duration_minutes: number | null;
  scheduled_minutes: number | null;
  setup_time_minutes: number | null;

  scheduled_start_at: string | null;
  scheduled_end_at: string | null;

  status: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MS = 60_000;

function addMin(d: Date, m: number) {
  return new Date(d.getTime() + m * MS);
}
function parseClock(t: string) {
  const [h, m, s = "0"] = t.split(":");
  return { h: +h, m: +m, s: +s };
}

function asBool(v: any, def: boolean) {
  if (v === undefined || v === null) return def;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase().trim();
  return s === "true" || s === "1";
}

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function isHoliday(holidays: HolidayRow[], day: Date) {
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, "0");
  const d = String(day.getDate()).padStart(2, "0");
  const key = `${y}-${m}-${d}`;
  return holidays.some((h) => (h.date || "").startsWith(key));
}

function dailyWindows(shifts: ShiftRow[], day: Date) {
  const dow = day.getDay();
  const todays = shifts.filter((s) => s.day_of_week === dow && s.is_working_day);
  const wins: { start: Date; end: Date }[] = [];
  for (const s of todays) {
    const st = parseClock(s.shift_start_time);
    const et = parseClock(s.shift_end_time);
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), st.h, st.m, +st.s);
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), et.h, et.m, +et.s);
    if (end > start) wins.push({ start, end });
  }
  wins.sort((a, b) => a.start.getTime() - b.start.getTime());
  return wins;
}

function* iterWindows(shifts: ShiftRow[], holidays: HolidayRow[], from: Date, horizonDays = 365) {
  for (let i = 0; i < horizonDays; i++) {
    const day = addMin(new Date(from.getFullYear(), from.getMonth(), from.getDate()), i * 24 * 60);
    if (isHoliday(holidays, day)) continue;
    for (const w of dailyWindows(shifts, day)) {
      if (w.end <= from) continue;
      const s = new Date(Math.max(w.start.getTime(), from.getTime()));
      yield { start: s, end: w.end };
    }
  }
}

function placeDuration(
  shifts: ShiftRow[],
  holidays: HolidayRow[],
  earliest: Date,
  minutes: number
) {
  let left = Math.max(0, Math.ceil(minutes));
  const placed: { start: Date; end: Date }[] = [];
  let cursor = new Date(earliest);

  for (const w of iterWindows(shifts, holidays, cursor)) {
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

function nextWorkingStart(shifts: ShiftRow[], holidays: HolidayRow[], from: Date) {
  for (const w of iterWindows(shifts, holidays, from, 365)) return w.start;
  return from;
}

function minutesForStage(s: JSI): number {
  const base =
    (Number.isFinite(s.actual_duration_minutes as any) ? s.actual_duration_minutes! : null) ??
    (Number.isFinite(s.estimated_duration_minutes as any) ? s.estimated_duration_minutes! : null) ??
    (Number.isFinite(s.scheduled_minutes as any) ? s.scheduled_minutes! : null) ??
    0;
  const setup =
    Number.isFinite(s.setup_time_minutes as any) && s.setup_time_minutes! > 0
      ? s.setup_time_minutes!
      : 0;

  // If absolutely nothing is there, we still enforce 1m; otherwise use base+setup
  const raw = base + setup;
  const mins = raw > 0 ? Math.max(1, Math.round(raw)) : 1;
  return mins;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const qp = (k: string, def?: any) => url.searchParams.get(k) ?? body[k] ?? def;

    const commit = asBool(qp("commit", true), true);
    const nuclear = asBool(qp("nuclear", false), false);
    const onlyIfUnset = asBool(qp("onlyIfUnset", false), false);

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

    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1) Load shifts & holidays
    const { data: shifts, error: shiftErr } = await sb
      .from("shift_schedules")
      .select("day_of_week,is_working_day,shift_start_time,shift_end_time")
      .order("day_of_week", { ascending: true })
      .returns<ShiftRow[]>();

    if (shiftErr) throw new Error("load shifts failed: " + JSON.stringify(shiftErr));
    if (!shifts?.length) throw new Error("No rows in shift_schedules");

    const { data: holidays, error: holErr } = await sb
      .from("public_holidays")
      .select("date")
      .returns<HolidayRow[]>();
    if (holErr) throw new Error("load holidays failed: " + JSON.stringify(holErr));

    // 2) Pick base start
    const seed = startFrom ?? addMin(new Date(), 24 * 60); // default tomorrow
    const baseStart = nextWorkingStart(shifts, holidays, seed);
    const unscheduledFromDate = ymd(baseStart);

    // 3) Nuclear wipe from that date if requested
    if (commit && nuclear) {
      // clear stage_time_slots from date
      const { error: delSlotsErr } = await sb
        .from("stage_time_slots")
        .delete()
        .gte("slot_start_time", `${unscheduledFromDate}T00:00:00Z`);
      if (delSlotsErr)
        throw new Error("wipe stage_time_slots failed: " + JSON.stringify(delSlotsErr));

      // reset JSI scheduled fields from date
      const { error: resetJsiErr } = await sb
        .from("job_stage_instances")
        .update({
          scheduled_start_at: null,
          scheduled_end_at: null,
          scheduled_minutes: null,
        })
        .gte("scheduled_start_at", `${unscheduledFromDate}T00:00:00Z`);
      if (resetJsiErr)
        throw new Error("wipe job_stage_instances failed: " + JSON.stringify(resetJsiErr));
    }

    // 4) Load stages to schedule
    // You can filter statuses here if needed (e.g., exclude completed)
    let query = sb
      .from("job_stage_instances")
      .select(
        [
          "id",
          "job_id",
          "production_stage_id",
          "stage_order",
          "actual_duration_minutes",
          "estimated_duration_minutes",
          "scheduled_minutes",
          "setup_time_minutes",
          "scheduled_start_at",
          "scheduled_end_at",
          "status",
        ].join(",")
      )
      .order("job_id", { ascending: true })
      .order("stage_order", { ascending: true })
      .returns<JSI[]>();

    if (onlyIfUnset) {
      query = query.is("scheduled_start_at", null);
    }
    const { data: jsis, error: jsiErr } = await query;
    if (jsiErr) throw new Error("load job_stage_instances failed: " + JSON.stringify(jsiErr));
    if (!jsis?.length) {
      return new Response(JSON.stringify({ ok: true, scheduled: 0, applied: { updated: 0 } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5) Plan
    type Update = {
      id: string;
      start_at: string;
      end_at: string;
      minutes: number;
    };
    const updates: Update[] = [];
    type Slot = {
      production_stage_id: string;
      job_id: string;
      slot_start_time: string;
      slot_end_time: string;
      duration_minutes: number;
    };
    const slots: Slot[] = [];

    // resource -> next free time
    const resourceFree = new Map<string, Date>();
    // job -> last stage end time
    const jobDone = new Map<string, Date>();

    // sort defensively
    const ordered = [...jsis].sort((a, b) => {
      if (a.job_id !== b.job_id) return a.job_id < b.job_id ? -1 : 1;
      const ao = a.stage_order ?? 9999;
      const bo = b.stage_order ?? 9999;
      return ao - bo;
    });

    for (const st of ordered) {
      // If only scheduling unset items and this already has times, skip
      if (onlyIfUnset && st.scheduled_start_at && st.scheduled_end_at) continue;

      const resource = st.production_stage_id;
      let earliest = baseStart;

      // honor job precedence
      const prevEnd = jobDone.get(st.job_id);
      if (prevEnd && prevEnd > earliest) earliest = prevEnd;

      // honor resource availability
      const free = resourceFree.get(resource);
      if (free && free > earliest) earliest = free;

      const mins = minutesForStage(st);
      const segs = placeDuration(shifts, holidays, earliest, mins);

      if (!segs.length) {
        // unable to place (no capacity in horizon)
        continue;
      }

      const start = segs[0].start;
      const end = segs[segs.length - 1].end;

      updates.push({
        id: st.id,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        minutes: mins,
      });

      for (const g of segs) {
        slots.push({
          production_stage_id: resource,
          job_id: st.job_id,
          slot_start_time: g.start.toISOString(),
          slot_end_time: g.end.toISOString(),
          duration_minutes: Math.round((g.end.getTime() - g.start.getTime()) / MS),
        });
      }

      jobDone.set(st.job_id, end);
      resourceFree.set(resource, end);
    }

    if (!commit) {
      return new Response(
        JSON.stringify({
          ok: true,
          scheduled: updates.length,
          applied: { updated: 0 },
          dryRun: true,
          baseStart: baseStart.toISOString(),
          startFrom: startFromStr || null,
          unscheduledFromDate,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6) Apply: update JSIs
    let updated = 0;
    if (updates.length) {
      // Do in chunks (to avoid payload limits)
      const chunk = 500;
      for (let i = 0; i < updates.length; i += chunk) {
        const part = updates.slice(i, i + chunk);

        // Build a mapping: id -> fields
        for (const u of part) {
          const { error } = await sb
            .from("job_stage_instances")
            .update({
              scheduled_start_at: u.start_at,
              scheduled_end_at: u.end_at,
              scheduled_minutes: u.minutes,
            })
            .eq("id", u.id);
          if (error)
            throw new Error("update job_stage_instances failed: " + JSON.stringify(error));
          updated += 1;
        }
      }
    }

    // 7) Apply: write stage_time_slots with upsert-on-conflict
    if (slots.length) {
      const chunk = 1000;
      for (let i = 0; i < slots.length; i += chunk) {
        const part = slots.slice(i, i + chunk);
        const { error } = await sb
          .from("stage_time_slots")
          .upsert(part, {
            onConflict: "production_stage_id,slot_start_time",
            ignoreDuplicates: false,
          });
        if (error)
          throw new Error("upsert stage_time_slots failed: " + JSON.stringify(error));
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        scheduled: updates.length,
        applied: { updated },
        baseStart: baseStart.toISOString(),
        startFrom: startFromStr || null,
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
