// supabase/functions/scheduler-run/index.ts
// Schedules job stage instances into stage_time_slots, respecting shift windows.
// - minutes source: (actual_duration_minutes || estimated_duration_minutes) + setup_time_minutes
// - splits long work across days (08:00–16:30) using shift_schedules
// - writes multiple rows to stage_time_slots per instance (carry segments)
// - updates job_stage_instances.scheduled_* correctly

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2";

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

  // minute sources (some may be null)
  actual_duration_minutes: number | null;
  estimated_duration_minutes: number | null;
  setup_time_minutes: number | null;
  scheduled_minutes: number | null;

  // schedule pins (may be null)
  scheduled_start_at: string | null; // ISO string with TZ
  scheduled_end_at: string | null;

  status: string | null; // e.g., 'pending'
};

type SlotInsert = {
  id?: string;
  production_stage_id: string;
  stage_instance_id: string;
  job_id: string | null;
  job_table_name: string | null;
  date: string;               // YYYY-MM-DD (NOT NULL)
  slot_start_time: string;    // ISO
  slot_end_time: string;      // ISO
  duration_minutes: number;
};

const SERVICE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SERVICE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

function toISO(d: Date) {
  return new Date(d.getTime()).toISOString();
}
function ymd(d: Date) {
  return toISO(d).slice(0, 10);
}
function minutesBetween(a: Date, b: Date) {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}
function addMinutes(d: Date, mins: number) {
  return new Date(d.getTime() + mins * 60000);
}
function atTime(date: Date, hhmmss: string) {
  const [hh, mm, ss] = hhmmss.split(":").map((x) => parseInt(x, 10));
  const d = new Date(date);
  d.setUTCHours(hh, mm, ss || 0, 0);
  return d;
}
function nextUTCDate(d: Date) {
  const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
  return n;
}

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
  return {
    start: atTime(dateUTC, s.shift_start_time),
    end: atTime(dateUTC, s.shift_end_time),
    working: true,
  };
}

// Compute minutes to schedule for a stage instance
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

  // Enforce 1..24h*3 safety bounds to avoid absurd writes if upstream is wrong
  const m = Math.max(1, Math.round(core + setup));
  return Math.min(m, 24 * 60 * 3);
}

async function deleteExistingSlots(stageInstanceId: string) {
  const { error } = await sb
    .from("stage_time_slots")
    .delete()
    .eq("stage_instance_id", stageInstanceId);
  if (error) throw new Error("deleteExistingSlots failed: " + error.message);
}

async function insertSlots(slots: SlotInsert[]) {
  if (!slots.length) return;
  // Provide id and job_table_name if your table expects them
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
    .update({
      scheduled_start_at: startISO,
      scheduled_end_at: endISO,
      scheduled_minutes: totalMinutes,
    })
    .eq("id", id);
  if (error) throw new Error("updateJSI failed: " + error.message);
}

// Split a stage across working windows, starting from a given start time
function splitByShift(
  jsi: JSI,
  shifts: Shift[],
  startAt: Date,
  minutesNeeded: number,
): SlotInsert[] {
  const out: SlotInsert[] = [];

  let remaining = minutesNeeded;
  let cursor = new Date(startAt);

  // Guard: if startAt falls on non-working day before first shift, roll forward
  while (remaining > 0) {
    const dayWindow = firstShiftWindow(shifts, cursor);
    if (!dayWindow.working) {
      cursor = nextUTCDate(cursor);
      continue;
    }

    // Align cursor to shift start if before, or push to next day if after
    if (cursor < dayWindow.start) cursor = new Date(dayWindow.start);
    if (cursor >= dayWindow.end) {
      cursor = nextUTCDate(cursor);
      continue;
    }

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

    // if we still have remaining, move to next day’s shift start
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
    // when true, only touch rows that don’t have start/end yet
    onlyIfUnset?: boolean;
    // limit to a single stage instance for debugging
    stageInstanceId?: string;
  };

  const onlyIfUnset = body.onlyIfUnset ?? false;
  const oneId = body.stageInstanceId ?? null;

  // 1) Shifts
  const shifts = await loadShifts();

  // 2) Pull stage instances to (re)write slots for
  //    We schedule only instances that are pending/ready; adapt the 'status' filter to your codes.
  let q = sb
    .from("job_stage_instances")
    .select(
      `
      id, job_id, production_stage_id, stage_order,
      actual_duration_minutes, estimated_duration_minutes, setup_time_minutes,
      scheduled_minutes, scheduled_start_at, scheduled_end_at, status
    `,
    )
    .neq("status", "completed")
    .order("production_stage_id", { ascending: true })
    .order("stage_order", { ascending: true });

  if (onlyIfUnset) {
    q = q.is("scheduled_start_at", null);
  }
  if (oneId) {
    q = q.eq("id", oneId);
  }

  const { data: rows, error } = await q;
  if (error) throw new Error("load JSIs failed: " + error.message);

  const jsis = rows as JSI[];

  const results: any[] = [];

  for (const jsi of jsis) {
    const minutes = minutesFor(jsi);
    // Start time: if already planned, reuse; else first shift from “today” (UTC)
    let startISO = jsi.scheduled_start_at;
    if (!startISO) {
      const today = new Date(); // UTC now
      // roll to next working day shift start
      let d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      while (true) {
        const w = firstShiftWindow(shifts, d);
        if (w.working) {
          startISO = toISO(w.start);
          break;
        }
        d = nextUTCDate(d);
      }
    }

    const startAt = new Date(startISO!);
    const slots = splitByShift(jsi, shifts, startAt, minutes);

    // Replace slots for this instance
    await deleteExistingSlots(jsi.id);
    await insertSlots(slots);

    const total = slots.reduce((s, x) => s + x.duration_minutes, 0);
    const finalStart = slots[0]?.slot_start_time ?? startISO!;
    const finalEnd = slots[slots.length - 1]?.slot_end_time ?? startISO!;

    await updateJSI(jsi.id, finalStart, finalEnd, total);

    results.push({
      stage_instance_id: jsi.id,
      stage: jsi.production_stage_id,
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

serve((req) =>
  run(req).catch((e) => {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  })
);
