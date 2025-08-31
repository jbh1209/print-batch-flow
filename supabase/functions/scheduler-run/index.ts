// supabase/functions/scheduler-run/index.ts
// Edge function to (re)build/append schedule into public.stage_time_slots.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type RunRequest = {
  commit?: boolean;
  proposed?: boolean;
  onlyIfUnset?: boolean;
  nuclear?: boolean;
  wipeAll?: boolean;
  startFrom?: string;         // "YYYY-MM-DD" or ISO
  onlyJobIds?: string[];      // restrict scope
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

type ShiftWindow = { start: Date; end: Date; isWorkingDay: boolean };

// ---------------- CORS helpers (dynamic reflection) ----------------
const ALLOW_ORIGIN = "*"; // optionally set to your app origin

function preflightHeaders(req: Request) {
  // reflect whatever headers the browser said it wants to send
  const requested = req.headers.get("access-control-request-headers") ?? "authorization,content-type,apikey,x-client-info";
  return {
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": requested,
    "Access-Control-Max-Age": "86400",
  };
}

const responseHeaders = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  // keep a permissive default list for non-preflight responses
  "Access-Control-Allow-Headers": "authorization,content-type,apikey,x-client-info",
  "Content-Type": "application/json",
};

// ---------------- Supabase client ----------------
function sbClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ---------------- Calendar (uses shift_start_time / shift_end_time) ----------------
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
  const dow = day.getUTCDay();
  const row = await fetchShiftRow(sb, dow);
  const base = day.toISOString().slice(0, 10);
  if (!row) {
    // conservative default
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
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 1));
      continue;
    }
    if (cursor < win.start) return win.start;
    if (cursor >= win.start && cursor < win.end) return cursor;

    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 1));
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

// ---------------- Allocation across shifts ----------------
function minutesBetween(a: Date, b: Date) {
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
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 1));
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

// ---------------- Core scheduler (with rendezvous) ----------------
async function executeScheduler(sb: SupabaseClient, req: RunRequest) {
  const startBase = req.startFrom ? new Date(req.startFrom) : new Date();
  const normalizedBase = await normalizeToNextWorkingStart(sb, startBase);

  if (req.nuclear || req.wipeAll) {
    await sb.from("stage_time_slots").delete().neq("id", 0);
    await sb
      .from("job_stage_instances")
      .update({ scheduled_start_at: null, scheduled_end_at: null })
      .in("status", ["pending", "queued"]);
  }

  let q = sb
    .from("job_stage_instances")
    .select(
      "id, job_id, production_stage_id, stage_order, scheduled_minutes, status, scheduled_start_at, scheduled_end_at, dependency_group",
    )
    .in("status", ["pending", "queued"]);

  if (req.onlyJobIds?.length) q = q.in("job_id", req.onlyJobIds);

  const { data, error } = await q;
  if (error) throw error;

  const items = (data as StageInstance[]).sort(
    (a, b) => (a.stage_order ?? 9999) - (b.stage_order ?? 9999) || a.id.localeCompare(b.id),
  );

  const prevEndByJob = new Map<string, Date>();        // last stage end per job
  const groupMembers = new Map<string, Set<string>>(); // group -> job ids

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
    if (req.onlyIfUnset && (it.scheduled_start_at || it.scheduled_end_at)) continue;

    const minutes = it.scheduled_minutes ?? 1;
    if (minutes <= 0) continue;

    // 1) previous stage end for this job
    const jobPrereq = prevEndByJob.get(it.job_id) ?? normalizedBase;

    // 2) rendezvous: wait until all jobs in the group have finished their prior stages
    let groupPrereq = jobPrereq;
    if (it.dependency_group) {
      const members = groupMembers.get(it.dependency_group) ?? new Set<string>();
      for (const jid of members) {
        const end = prevEndByJob.get(jid) ?? normalizedBase;
        if (end > groupPrereq) groupPrereq = end;
      }
    }

    // 3) stage queue tail / working start
    const stageTail = await stageQueueTailOrWorkingStart(sb, it.production_stage_id, normalizedBase);

    const startCandidate = new Date(Math.max(jobPrereq.getTime(), groupPrereq.getTime(), stageTail.getTime()));

    const { first, last, slots } = await allocateSlots(sb, startCandidate, minutes);

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

    prevEndByJob.set(it.job_id, new Date(last));
    scheduled++;
  }

  return { ok: true, scheduled, slotsInserted, considered: items.length };
}

// ---------------- HTTP entry ----------------
serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: preflightHeaders(req) });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST only" }), {
        status: 405,
        headers: responseHeaders,
      });
    }

    const sb = sbClient();
    let body: RunRequest;
    try {
      body = (await req.json()) as RunRequest;
    } catch {
      body = {};
    }

    // Defaults
    body.commit ??= true;
    body.proposed ??= false;
    body.onlyIfUnset ??= false;
    body.nuclear ??= false;
    body.wipeAll ??= false;

    const result = await executeScheduler(sb, body);
    return new Response(JSON.stringify(result), { status: 200, headers: responseHeaders });
  } catch (err) {
    console.error("scheduler-run fatal:", err);
    const message = err && typeof err === "object" && "message" in err ? (err as Error).message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: responseHeaders });
  }
});
