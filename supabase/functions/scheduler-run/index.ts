// supabase/functions/scheduler-run/index.ts
// Edge function: schedule/append production jobs into working shifts.
//
// Request body (examples)
//  - Append one job:  { commit:true, proposed:false, onlyIfUnset:true,  onlyJobIds:["<uuid>"] }
//  - Reschedule all:  { commit:true, proposed:false, onlyIfUnset:false, nuclear:true, wipeAll:true, startFrom:"2025-08-30" }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type Json = Record<string, unknown>;

type RunRequest = {
  commit?: boolean;
  proposed?: boolean;
  onlyIfUnset?: boolean;
  nuclear?: boolean;
  wipeAll?: boolean;
  startFrom?: string; // "YYYY-MM-DD" or ISO
  onlyJobIds?: string[];
};

type StageInstance = {
  id: string;
  job_id: string;
  production_stage_id: string;
  stage_order: number | null;
  scheduled_minutes: number | null;
  status: string | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  dependency_group: string | null;
};

type ShiftWindow = {
  start: Date;
  end: Date;
  isWorkingDay: boolean;
};

const ORIGIN = "*"; // your UI domain if you prefer to lock down

// ---------- util: CORS ----------
const cors = {
  headers: {
    "Access-Control-Allow-Origin": ORIGIN,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  },
};

// ---------- boot Supabase (service role) ----------
function sbClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ---------- calendar helpers (FIXED column names) ----------
async function fetchShiftRow(sb: SupabaseClient, dow: number) {
  const { data, error } = await sb
    .from("shift_schedules")
    .select("day_of_week, shift_start_time, shift_end_time, is_working_day, is_active")
    .eq("day_of_week", dow)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data as
    | {
        day_of_week: number;
        shift_start_time: string;
        shift_end_time: string;
        is_working_day: boolean;
        is_active: boolean;
      }
    | null;
}

async function isHoliday(sb: SupabaseClient, day: Date) {
  const ymd = day.toISOString().slice(0, 10);
  const { data, error } = await sb
    .from("public_holidays")
    .select("date")
    .eq("is_active", true)
    .eq("date", ymd)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

async function getShiftWindow(sb: SupabaseClient, day: Date): Promise<ShiftWindow> {
  const dow = day.getUTCDay(); // 0..6
  const row = await fetchShiftRow(sb, dow);
  const base = day.toISOString().slice(0, 10);
  if (!row) {
    return {
      start: new Date(`${base}T08:00:00Z`),
      end: new Date(`${base}T16:30:00Z`),
      isWorkingDay: false,
    };
  }
  return {
    start: new Date(`${base}T${row.shift_start_time}Z`),
    end: new Date(`${base}T${row.shift_end_time}Z`),
    isWorkingDay: row.is_working_day,
  };
}

async function normalizeToNextWorkingStart(sb: SupabaseClient, from: Date): Promise<Date> {
  let cursor = new Date(from);
  for (let i = 0; i < 21; i++) {
    const win = await getShiftWindow(sb, cursor);
    const holiday = await isHoliday(sb, cursor);
    const working = win.isWorkingDay && !holiday;
    if (!working) {
      // move to next day
      cursor = new Date(Date.UTC(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth(),
        cursor.getUTCDate() + 1,
        0, 0, 0,
      ));
      continue;
    }
    if (cursor < win.start) return win.start;
    if (cursor >= win.start && cursor < win.end) return cursor;
    // after end -> next day 00:00
    cursor = new Date(Date.UTC(
      cursor.getUTCFullYear(),
      cursor.getUTCMonth(),
      cursor.getUTCDate() + 1,
      0, 0, 0,
    ));
  }
  return from;
}

async function stageQueueTailOrWorkingStart(
  sb: SupabaseClient,
  stageId: string,
  fallbackStart: Date,
): Promise<Date> {
  const { data, error } = await sb
    .from("stage_time_slots")
    .select("slot_end_time")
    .eq("production_stage_id", stageId)
    .order("slot_end_time", { ascending: false })
    .limit(1);
  if (error) throw error;
  const tail = data?.[0]?.slot_end_time ? new Date(data[0].slot_end_time as string) : null;
  const normalized = await normalizeToNextWorkingStart(sb, fallbackStart);
  return tail && tail > normalized ? tail : normalized;
}

// ---------- slot allocator (across shifts) ----------
function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

async function allocateSlots(
  sb: SupabaseClient,
  startAt: Date,
  minutes: number,
): Promise<{ first: Date; last: Date; slots: { start: Date; end: Date }[] }> {
  let cursor = new Date(startAt);
  const slots: { start: Date; end: Date }[] = [];
  let first: Date | null = null;
  let last: Date | null = null;

  while (minutes > 0) {
    const win = await getShiftWindow(sb, cursor);
    const holiday = await isHoliday(sb, cursor);
    const working = win.isWorkingDay && !holiday;

    if (!working || cursor >= win.end) {
      // jump to next day start
      cursor = new Date(Date.UTC(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth(),
        cursor.getUTCDate() + 1,
        0, 0, 0,
      ));
      continue;
    }

    if (cursor < win.start) cursor = new Date(win.start);

    const cap = minutesBetween(cursor, win.end);
    const take = Math.min(cap, minutes);
    const s = new Date(cursor);
    const e = new Date(cursor.getTime() + take * 60000);

    slots.push({ start: s, end: e });
    if (!first) first = s;
    last = e;

    minutes -= take;
    cursor = new Date(e);
  }

  return { first: first!, last: last!, slots };
}

// ---------- core scheduler ----------
async function executeScheduler(sb: SupabaseClient, req: RunRequest) {
  const startBase = req.startFrom ? new Date(req.startFrom) : new Date();
  const normalizedBase = await normalizeToNextWorkingStart(sb, startBase);

  // Wipe all if requested
  if (req.nuclear || req.wipeAll) {
    await sb.from("stage_time_slots").delete().neq("id", 0);
    await sb
      .from("job_stage_instances")
      .update({ scheduled_start_at: null, scheduled_end_at: null })
      .in("status", ["pending", "queued"]);
  }

  // What to consider
  let query = sb
    .from("job_stage_instances")
    .select(
      "id, job_id, production_stage_id, stage_order, scheduled_minutes, status, scheduled_start_at, scheduled_end_at, dependency_group",
    )
    .in("status", ["pending", "queued"]);

  if (req.onlyJobIds && req.onlyJobIds.length > 0) {
    query = query.in("job_id", req.onlyJobIds);
  }

  const { data: stages, error } = await query;
  if (error) throw error;

  // Order by stage_order asc then by id for stability
  const items = (stages as StageInstance[]).sort(
    (a, b) => (a.stage_order ?? 9999) - (b.stage_order ?? 9999) || a.id.localeCompare(b.id),
  );

  // tracking maps
  const prevEndByJob = new Map<string, Date>(); // last scheduled end per job
  const groupMembers = new Map<string, Set<string>>(); // dependency_group -> set(job_ids)

  // Build group membership (for rendezvous)
  for (const it of items) {
    if (it.dependency_group) {
      const set = groupMembers.get(it.dependency_group) ?? new Set<string>();
      set.add(it.job_id);
      groupMembers.set(it.dependency_group, set);
    }
  }

  let scheduled = 0;
  let slotsInserted = 0;

  for (const it of items) {
    // skip if append-only and already has a schedule
    if (req.onlyIfUnset && (it.scheduled_start_at || it.scheduled_end_at)) continue;

    const minutes = it.scheduled_minutes ?? 1;
    if (minutes <= 0) continue;

    // 1) job prerequisite: end of previous stage for this job
    const jobPrereq = prevEndByJob.get(it.job_id) ?? normalizedBase;

    // 2) group rendezvous prerequisite (if any)
    let groupPrereq = jobPrereq;
    if (it.dependency_group) {
      // A grouped stage starts only when all jobs in that group have finished their previous stages.
      const members = groupMembers.get(it.dependency_group) ?? new Set<string>();
      for (const jid of members) {
        const end = prevEndByJob.get(jid) ?? normalizedBase;
        if (end > groupPrereq) groupPrereq = end;
      }
    }

    // 3) stage queue tail vs working start
    const stageTail = await stageQueueTailOrWorkingStart(sb, it.production_stage_id, normalizedBase);

    // Actual start candidate
    const startCandidate = new Date(Math.max(jobPrereq.getTime(), groupPrereq.getTime(), stageTail.getTime()));

    // Allocate slots across shifts
    const { first, last, slots } = await allocateSlots(sb, startCandidate, minutes);

    // Write (only when commit)
    if (req.commit !== false) {
      if (slots.length) {
        const rows = slots.map((s) => ({
          production_stage_id: it.production_stage_id,
          stage_instance_id: it.id,
          slot_start_time: s.start.toISOString(),
          slot_end_time: s.end.toISOString(),
        }));
        const { error: insErr } = await sb.from("stage_time_slots").insert(rows);
        if (insErr) throw insErr;
        slotsInserted += rows.length;
      }

      const { error: updErr } = await sb
        .from("job_stage_instances")
        .update({
          scheduled_start_at: first.toISOString(),
          scheduled_end_at: last.toISOString(),
          status: it.status === "pending" ? "queued" : it.status,
        })
        .eq("id", it.id);
      if (updErr) throw updErr;
    }

    // update maps
    prevEndByJob.set(it.job_id, new Date(last));
    scheduled++;
  }

  return {
    ok: true,
    scheduled,
    slotsInserted,
    considered: items.length,
  };
}

// ---------- HTTP entry ----------
serve(async (request: Request) => {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors.headers });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST only" }), {
        status: 405,
        headers: cors.headers,
      });
    }

    const sb = sbClient();

    let body: RunRequest;
    try {
      body = (await request.json()) as RunRequest;
    } catch {
      body = {};
    }

    // defaults
    body.commit ??= true;
    body.proposed ??= false;
    body.onlyIfUnset ??= false;
    body.nuclear ??= false;
    body.wipeAll ??= false;

    const result = await executeScheduler(sb, body);
    return new Response(JSON.stringify(result), { status: 200, headers: cors.headers });
  } catch (err) {
    const msg =
      err && typeof err === "object" && "message" in err ? (err as Error).message : String(err);
    // emit a compact error; server logs will have the stack/PG code
    console.error("scheduler-run fatal:", err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: cors.headers,
    });
  }
});
