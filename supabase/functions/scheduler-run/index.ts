// supabase/functions/scheduler-run/index.ts
// Schedules job stage instances into stage_time_slots, respecting shift windows.
// - minutes source: (actual_duration_minutes || estimated_duration_minutes) + setup_time_minutes
// - splits long work across days (08:00–16:30) using shift_schedules
// - inserts multiple rows to stage_time_slots per stage instance (carry segments)
// - updates job_stage_instances.scheduled_* correctly
// - **CORS enabled**: responds to OPTIONS and adds Access-Control-* headers to all responses

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2";

// ---------- CORS ----------
const corsHeadersBase = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};
function corsHeadersFor(req: Request) {
  // mirror the requesting origin (safer than "*", works with auth headers)
  const origin = req.headers.get("Origin") ?? "*";
  return { ...corsHeadersBase, "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}
function withCors(req: Request, res: Response) {
  const h = new Headers(res.headers);
  const extra = corsHeadersFor(req);
  Object.entries(extra).forEach(([k, v]) => h.set(k, v));
  return new Response(res.body, { status: res.status, headers: h });
}
// --------------------------

type Shift = {
  day_of_week: number; // 0..6
  is_working_day: boolean;
  shift_start_time: string; // "08:00:00"
  shift_end_time: string;   // "16:30:00"
};

type JSI = {
  id: string;
  job_id: string;
  production_stage_id: string;
  stage_order: number | null;

  actual_duration_minutes: number | null;
  estimated_duration_minutes: number | null;
  setup_time_minutes: number | null;
  scheduled_minutes: number | null;

  scheduled_start_at: string | null; // ISO with TZ
  scheduled_end_at: string | null;

  status: string | null;
};

type SlotInsert = {
  id?: string;
  production_stage_id: string;
  stage_instance_id: string;
  job_id: string | null;
  job_table_name: string | null;
  date: string;               // YYYY-MM-DD
  slot_start_time: string;    // ISO
  slot_end_time: string;      // ISO
  duration_minutes: number;
};

const SERVICE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SERVICE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

function toISO(d: Date) { return new Date(d.getTime()).toISOString(); }
function ymd(d: Date) { return toISO(d).slice(0, 10); }
function minutesBetween(a: Date, b: Date) { return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000)); }
function addMinutes(d: Date, mins: number) { return new Date(d.getTime() + mins * 60000); }
function atTime(date: Date, hhmmss: string) {
  const [hh, mm, ss] = hhmmss.split(":").map((x) => parseInt(x, 10));
  const d = new Date(date);
  d.setUTCHours(hh, mm, ss || 0, 0);
  return d;
}
function nextUTCDate(d: Date) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)); }

async function loadShifts(): Promise<Shift[]> {
  const { data, error } = await sb
    .from("shift_schedules")
    .select("day_of_week,is_working_day,shift_start_time,shift_end_time")
    .order("day_of_week", { ascending: true });
  if (error) throw new Error("loadShifts failed: " + error.message);
  return data as Shift[];
}

function firstShiftWindow(shifts: Shift[], dateUTC: Date): { start: Date; end: Date; working: boolean } {
  const dow = dateUTC.getUTCDay();
  const s = shifts.find((x) => x.day_of_week === dow);
  if (!s || !s.is_working_day) {
    return { start: atTime(dateUTC, "00:00:00"), end: atTime(dateUTC, "00:00:00"), working: false };
  }
  return { start: atTime(dateUTC, s.shift_start_time), end: atTime(dateUTC, s.shift_end_time), working: true };
}

// Minutes to schedule for an instance
function minutesFor(jsi: JSI): number {
  const core =
    Number.isFinite(jsi.actual_duration_minutes as any)
      ? (jsi.actual_duration_minutes as number)
      : Number.isFinite(jsi.estimated_duration_minutes as any)
        ? (jsi.estimated_duration_minutes as number)
        : 0;
  const setup =
    Number.isFinite(jsi.setup_time_minutes as any)
      ? (jsi.setup_time_minutes as number)
      : 0;
  const m = Math.max(1, Math.round(core + setup));
  return Math.min(m, 24 * 60 * 3); // clamp to 3 days to avoid garbage data explosions
}

async function deleteExistingSlots(stageInstanceId: string) {
  const { error } = await sb.from("stage_time_slots").delete().eq("stage_instance_id", stageInstanceId);
  if (error) throw new Error("deleteExistingSlots failed: " + error.message);
}

async function insertSlots(slots: SlotInsert[]) {
  if (!slots.length) return;
  const enriched = slots.map((s) => ({
    id: crypto.randomUUID(),
    job_table_name: s.job_table_name ?? "production_jobs",
    ...s,
  }));
  const { error } = await sb.from("stage_time_slots").upsert(enriched, {
    onConflict: "production_stage_id,slot_start_time",
    ignoreDuplicates: false,
  });
  if (error) throw new Error("upsert stage_time_slots failed: " + error.message);
}

async function updateJSI(id: string, startISO: string, endISO: string, totalMinutes: number) {
  const { error } = await sb
    .from("job_stage_instances")
    .update({ scheduled_start_at: startISO, scheduled_end_at: endISO, scheduled_minutes: totalMinutes })
    .eq("id", id);
  if (error) throw new Error("updateJSI failed: " + error.message);
}

function splitByShift(jsi: JSI, shifts: Shift[], startAt: Date, minutesNeeded: number): SlotInsert[] {
  const out: SlotInsert[] = [];
  let remaining = minutesNeeded;
  let cursor = new Date(startAt);

  while (remaining > 0) {
    const dayWindow = firstShiftWindow(shifts, cursor);
    if (!dayWindow.working) { cursor = nextUTCDate(cursor); continue; }

    if (cursor < dayWindow.start) cursor = new Date(dayWindow.start);
    if (cursor >= dayWindow.end) { cursor = nextUTCDate(cursor); continue; }

    const usableToday = minutesBetween(cursor, dayWindow.end);
    const take = Math.min(usableToday, remaining);
    const segEnd = addMinutes(cursor, take);

    out.push({
      production_stage_id: jsi.production_stage_id,
      stage_instance_id: jsi.id,
      job_id: jsi.job_id,
      job_table_name: "production_jobs",
      date: ymd(cursor),
      slot_start_time: toISO(cursor),
      slot_end_time: toISO(segEnd),
      duration_minutes: take,
    });

    remaining -= take;
    cursor = segEnd;

    if (remaining > 0) {
      const nextDay = nextUTCDate(cursor);
      const nextWin = firstShiftWindow(shifts, nextDay);
      cursor = nextWin.working ? nextWin.start : nextDay;
    }
  }
  return out;
}

async function run(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    onlyIfUnset?: boolean;
    stageInstanceId?: string;
  };

  const onlyIfUnset = body.onlyIfUnset ?? false;
  const oneId = body.stageInstanceId ?? null;

  const shifts = await loadShifts();

  let q = sb
    .from("job_stage_instances")
    .select(`
      id, job_id, production_stage_id, stage_order,
      actual_duration_minutes, estimated_duration_minutes, setup_time_minutes,
      scheduled_minutes, scheduled_start_at, scheduled_end_at, status
    `)
    .neq("status", "completed")
    .order("production_stage_id", { ascending: true })
    .order("stage_order", { ascending: true });

  if (onlyIfUnset) q = q.is("scheduled_start_at", null);
  if (oneId) q = q.eq("id", oneId);

  const { data: rows, error } = await q;
  if (error) throw new Error("load JSIs failed: " + error.message);
  const jsis = rows as JSI[];

  const results: any[] = [];

  for (const jsi of jsis) {
    const minutes = minutesFor(jsi);

    // choose a start time:
    let startISO = jsi.scheduled_start_at;
    if (!startISO) {
      const today = new Date(); // UTC today
      let d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      while (true) {
        const w = firstShiftWindow(shifts, d);
        if (w.working) { startISO = toISO(w.start); break; }
        d = nextUTCDate(d);
      }
    }
    const startAt = new Date(startISO!);

    const slots = splitByShift(jsi, shifts, startAt, minutes);

    await deleteExistingSlots(jsi.id);
    await insertSlots(slots);

    const total = slots.reduce((s, x) => s + x.duration_minutes, 0);
    const finalStart = slots[0]?.slot_start_time ?? startISO!;
    const finalEnd   = slots[slots.length - 1]?.slot_end_time ?? startISO!;

    await updateJSI(jsi.id, finalStart, finalEnd, total);

    results.push({
      stage_instance_id: jsi.id,
      minutes_requested: minutes,
      minutes_scheduled: total,
      segments: slots.length,
      start: finalStart,
      end: finalEnd,
    });
  }

  return new Response(JSON.stringify({ ok: true, count: results.length, results }, null, 2), {
    headers: { "content-type": "application/json" },
  });
}

// ----- HTTP entry with CORS -----
serve(async (req) => {
  // Handle the preflight
  if (req.method === "OPTIONS") {
    return withCors(req, new Response("ok", { status: 204 }));
  }
  try {
    const res = await run(req);
    return withCors(req, res);
  } catch (e) {
    console.error(e);
    const res = new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
    return withCors(req, res);
  }
});
