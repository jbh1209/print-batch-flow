// supabase/functions/scheduler-run/index.ts
// Edge function: schedule appendix & rebuild with precedence + shift calendar.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type RequestBody = {
  commit?: boolean;
  proposed?: boolean;
  onlyIfUnset?: boolean;
  nuclear?: boolean;
  wipeAll?: boolean;
  startFrom?: string | null;
  onlyJobIds?: string[] | null;
};

type ShiftRow = {
  day_of_week: number;
  is_working_day: boolean;
  start_time: string;
  end_time: string;
};

type HolidayRow = { date: string; is_active: boolean };

type StageInstance = {
  jsi_id: string;
  job_id: string;
  wo_no: string;
  production_stage_id: string;
  stage_order: number;
  status: string | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  scheduled_minutes: number | null;
  estimated_duration_minutes: number | null;
  setup_time_minutes: number | null;
};

type QueueTail = Record<string, string | null>; // production_stage_id -> last slot_end_time (ISO)

function getClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, key, { auth: { persistSession: false } });
}

function iso(d: Date): string { return d.toISOString(); }
function fromISO(s: string): Date { return new Date(s); }
function parseHHMM(ss: string): { h: number; m: number } {
  const [h, m] = ss.slice(0,5).split(":").map((n) => parseInt(n, 10));
  return { h, m };
}
function setTimeUTC(d: Date, hhmm: string): Date {
  const { h, m } = parseHHMM(hhmm);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m, 0, 0));
}
function addMinutesUTC(d: Date, mins: number): Date { return new Date(d.getTime() + mins * 60_000); }
function ymd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type Calendar = {
  byDow: Record<number, { working: boolean; start: string; end: string }>;
  holidays: Set<string>; // YYYY-MM-DD
};

function buildCalendar(shiftRows: ShiftRow[], holidayRows: HolidayRow[]): Calendar {
  const byDow: Calendar["byDow"] = {};
  for (const r of shiftRows) {
    byDow[r.day_of_week] = { working: !!r.is_working_day, start: r.start_time, end: r.end_time };
  }
  const holidays = new Set<string>();
  for (const h of holidayRows) if (h.is_active) holidays.add(h.date);
  return { byDow, holidays };
}

function isWorkingDay(cal: Calendar, d: Date): boolean {
  const dow = d.getUTCDay();
  const row = cal.byDow[dow];
  return !!row?.working && !cal.holidays.has(ymd(d));
}
function shiftStart(cal: Calendar, d: Date): Date {
  const row = cal.byDow[d.getUTCDay()];
  return setTimeUTC(d, row?.start ?? "08:00:00");
}
function shiftEnd(cal: Calendar, d: Date): Date {
  const row = cal.byDow[d.getUTCDay()];
  return setTimeUTC(d, row?.end ?? "16:30:00");
}
function nextWorkingStart(cal: Calendar, at: Date): Date {
  let d = new Date(at);
  for (let guard = 0; guard < 400; guard++) {
    if (!isWorkingDay(cal, d)) {
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0));
      continue;
    }
    const s = shiftStart(cal, d), e = shiftEnd(cal, d);
    if (d < s) return s;
    if (d >= e) {
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0));
      continue;
    }
    return d; // inside shift
  }
  return shiftStart(cal, d);
}
function addWorkingMinutes(cal: Calendar, start: Date, minutes: number): Date {
  let cur = new Date(start);
  let left = Math.max(0, Math.floor(minutes));
  for (let guard = 0; guard < 10000 && left > 0; guard++) {
    cur = nextWorkingStart(cal, cur);
    const e = shiftEnd(cal, cur);
    const room = Math.max(0, Math.floor((e.getTime() - cur.getTime()) / 60000));
    if (room === 0) { cur = addMinutesUTC(e, 1); continue; }
    const use = Math.min(room, left);
    cur = addMinutesUTC(cur, use);
    left -= use;
  }
  return cur;
}

async function fetchCalendar(sb: SupabaseClient): Promise<Calendar> {
  const shifts = await sb.from("shift_schedules")
    .select("day_of_week,is_working_day,start_time,end_time");
  if (shifts.error) throw shifts.error;

  // ✅ Query holidays once with correct column names in your DB
  const hol = await sb.from("public_holidays").select("date,is_active");
  if (hol.error) throw hol.error;

  return buildCalendar(shifts.data as ShiftRow[], hol.data as HolidayRow[]);
}

async function wipeSlots(
  sb: SupabaseClient,
  opts: { onlyJobIds?: string[] | null; wipeAll?: boolean }
) {
  if (opts.wipeAll) {
    // ✅ Safe “match-all” filter that works with your schema (no `id` column)
    const del = await sb.from("stage_time_slots")
      .delete()
      .not("production_stage_id", "is", null);
    if (del.error) throw del.error;
    return;
  }
  if (opts.onlyJobIds && opts.onlyJobIds.length > 0) {
    const { data: jsi, error } = await sb
      .from("job_stage_instances")
      .select("id")
      .in("job_id", opts.onlyJobIds);
    if (error) throw error;
    const ids = (jsi ?? []).map((r: any) => r.id);
    if (ids.length > 0) {
      const del = await sb.from("stage_time_slots").delete().in("stage_instance_id", ids);
      if (del.error) throw del.error;
    }
  }
}

async function queueTailsFor(sb: SupabaseClient, stageIds: string[]): Promise<QueueTail> {
  if (stageIds.length === 0) return {};
  const { data, error } = await sb
    .from("stage_time_slots")
    .select("production_stage_id, slot_end_time")
    .in("production_stage_id", stageIds)
    .order("slot_end_time", { ascending: false });
  if (error) throw error;
  const tails: QueueTail = {};
  for (const r of data ?? []) if (!tails[r.production_stage_id]) tails[r.production_stage_id] = r.slot_end_time;
  return tails;
}

async function fetchStagesToSchedule(
  sb: SupabaseClient,
  onlyJobIds: string[] | null,
  onlyIfUnset: boolean
): Promise<StageInstance[]> {
  let base = sb.from("job_stage_instances")
    .select(`
      jsi_id:id,
      job_id,
      production_stage_id,
      stage_order,
      status,
      scheduled_start_at,
      scheduled_end_at,
      scheduled_minutes,
      estimated_duration_minutes,
      setup_time_minutes,
      production_jobs!inner(wo_no)
    `)
    .order("job_id", { ascending: true })
    .order("stage_order", { ascending: true });

  if (onlyJobIds && onlyJobIds.length > 0) base = base.in("job_id", onlyJobIds);

  const { data, error } = await base.neq("status", "completed");
  if (error) throw error;

  const rows = (data ?? []).map((r: any) => ({
    jsi_id: r.jsi_id,
    job_id: r.job_id,
    wo_no: r.production_jobs.wo_no,
    production_stage_id: r.production_stage_id,
    stage_order: r.stage_order,
    status: r.status,
    scheduled_start_at: r.scheduled_start_at,
    scheduled_end_at: r.scheduled_end_at,
    scheduled_minutes: r.scheduled_minutes,
    estimated_duration_minutes: r.estimated_duration_minutes,
    setup_time_minutes: r.setup_time_minutes,
  })) as StageInstance[];

  return onlyIfUnset ? rows.filter(r => !r.scheduled_start_at) : rows;
}

async function executeScheduler(
  sb: SupabaseClient,
  request: Required<RequestBody> & { baseStart: string }
): Promise<{ jobs_considered: number; scheduled: number; applied: { updated: number } }> {

  const cal = await fetchCalendar(sb);
  let baseStart = nextWorkingStart(cal, fromISO(request.baseStart));

  const stages = await fetchStagesToSchedule(sb, request.onlyJobIds ?? null, !!request.onlyIfUnset);
  const uniqueStageIds = [...new Set(stages.map(s => s.production_stage_id))];

  let tails = await queueTailsFor(sb, uniqueStageIds);
  for (const sid of uniqueStageIds) {
    const t = tails[sid] ? fromISO(tails[sid] as string) : null;
    tails[sid] = iso(nextWorkingStart(cal, t ? t : baseStart));
  }

  if (request.nuclear || request.wipeAll) {
    await wipeSlots(sb, { onlyJobIds: request.onlyJobIds ?? null, wipeAll: !!request.wipeAll });
    for (const sid of uniqueStageIds) tails[sid] = iso(baseStart);
  }

  const byJob = new Map<string, StageInstance[]>();
  for (const s of stages) {
    const arr = byJob.get(s.job_id) ?? [];
    arr.push(s);
    byJob.set(s.job_id, arr);
  }

  let scheduled = 0;
  const updates: Array<{ jsi_id: string; start: string; end: string; minutes: number; production_stage_id: string; }> = [];

  for (const [job_id, list] of byJob.entries()) {
    list.sort((a, b) => a.stage_order - b.stage_order);
    let lastEnd = baseStart;

    for (const s of list) {
      if (request.onlyIfUnset && s.scheduled_start_at) continue;

      const minutes =
        (s.scheduled_minutes ?? 0) > 0
          ? (s.scheduled_minutes as number)
          : Math.max(1, Math.floor((s.estimated_duration_minutes ?? 0) + (s.setup_time_minutes ?? 0)));

      const prevEnd = lastEnd;
      const tailStr = tails[s.production_stage_id] as string | null;
      const tail = tailStr ? fromISO(tailStr) : baseStart;
      let start = new Date(Math.max(prevEnd.getTime(), tail.getTime(), baseStart.getTime()));
      start = nextWorkingStart(cal, start);
      const end = addWorkingMinutes(cal, start, minutes);

      updates.push({
        jsi_id: s.jsi_id,
        start: iso(start),
        end: iso(end),
        minutes,
        production_stage_id: s.production_stage_id,
      });
      scheduled++;
      lastEnd = end;
      tails[s.production_stage_id] = iso(end);
    }
  }

  let updatedRows = 0;
  if (request.commit && updates.length > 0) {
    if (!request.onlyIfUnset) {
      const ids = updates.map(u => u.jsi_id);
      const del = await sb.from("stage_time_slots").delete().in("stage_instance_id", ids);
      if (del.error) throw del.error;
    }

    const insPayload = updates.map(u => ({
      production_stage_id: u.production_stage_id,
      stage_instance_id: u.jsi_id,
      slot_start_time: u.start,
      slot_end_time: u.end,
    }));
    const ins = await sb.from("stage_time_slots").insert(insPayload);
    if (ins.error) throw ins.error;

    for (const u of updates) {
      const up = await sb.from("job_stage_instances").update({
        scheduled_start_at: u.start,
        scheduled_end_at: u.end,
        scheduled_minutes: u.minutes,
        status: "queued",
      }).eq("id", u.jsi_id);
      if (up.error) throw up.error;
      updatedRows += 1;
    }
  }

  return { jobs_considered: byJob.size, scheduled, applied: { updated: updatedRows } };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    if (req.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const commit = !!body.commit;
    const proposed = !!body.proposed;
    const onlyIfUnset = !!body.onlyIfUnset;
    const nuclear = !!body.nuclear;
    const wipeAll = !!body.wipeAll;
    const onlyJobIds = (body.onlyJobIds ?? [])?.filter(Boolean) ?? [];

    const now = new Date();
    const baseAnchor = body.startFrom ? new Date(`${body.startFrom}T00:00:00Z`) : now;

    const sb = getClient();
    const cal = await fetchCalendar(sb);
    const normalizedBase = nextWorkingStart(cal, baseAnchor);

    const result = await executeScheduler(sb, {
      commit,
      proposed,
      onlyIfUnset,
      nuclear,
      wipeAll,
      startFrom: body.startFrom ?? null,
      onlyJobIds,
      baseStart: iso(normalizedBase),
    });

    return json({ ok: true, message: "ok", baseStart: iso(normalizedBase), ...result });

  } catch (err: any) {
    return json({ ok: false, error: String(err?.message ?? err) }, 500);
  }
});

function json(payload: any, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}
