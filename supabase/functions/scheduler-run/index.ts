// deno-lint-ignore-file no-explicit-any
// Scheduler (production) with cross-part synchronisation
// ------------------------------------------------------
// Expects JSON body like the UI already sends:
//
//  { commit: true, proposed: false, onlyIfUnset: true|false,
//    nuclear: false|true, wipeAll: false|true,
//    startFrom?: "YYYY-MM-DD", onlyJobIds?: [uuid,...] }
//
// Notes:
//  • We use job_stage_instances.estimated_duration_minutes when present,
//    otherwise job_stage_instances.scheduled_minutes, else 1.
//  • Rendezvous: if jsi.dependency_group is not null, we delay all peers
//    in that group to the MAX of their own "prev_end" (end of previous stage).
//  • We do not change jsi.status; schedule is expressed via stage_time_slots.
//
// CORS is permissive so your preview/staging domains can call this directly.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------- ENV ----------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY =
  Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SERVICE_ROLE_KEY");
}

type ISODate = string;

type RunRequest = {
  commit?: boolean;
  proposed?: boolean;
  onlyIfUnset?: boolean;
  nuclear?: boolean;
  wipeAll?: boolean;
  startFrom?: ISODate;           // YYYY-MM-DD (plant local)
  onlyJobIds?: string[];
};

type ShiftRow = {
  day_of_week: number;  // 0..6 (Sun..Sat)
  is_working_day: boolean;
  start_time: string;   // "08:00"
  end_time: string;     // "16:30"
};

type HolidayRow = { date: ISODate; is_active: boolean };

type JSI = {
  id: string;
  job_id: string;
  production_stage_id: string;
  stage_name: string | null;
  stage_order: number | null;
  dependency_group: string | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  scheduled_minutes: number | null;
  estimated_duration_minutes: number | null;
  created_at: string;
  status: string | null;
};

// ---- tiny date helpers (UTC) ----
const toDate = (s: string | Date) => new Date(s);
const fmt = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
const setTime = (d: Date, hh: number, mm: number) => {
  const nd = new Date(d);
  nd.setUTCHours(hh, mm, 0, 0);
  return nd;
};
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);
const startOfDayUTC = (d: Date) => setTime(d, 0, 0);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

// ---- CORS ----
const ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, prefer";
const cors = (headers: Headers) => {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", ALLOW_HEADERS);
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return headers;
};

// ---- Shift calendar + holidays ----
async function loadCalendar(sb: SupabaseClient) {
  const { data: shifts, error: e1 } = await sb
    .from("shift_schedules")
    .select("day_of_week,is_working_day,start_time,end_time")
    .returns<ShiftRow[]>();
  if (e1) throw e1;

  const { data: hols, error: e2 } = await sb
    .from("public_holidays")
    .select("date,is_active")
    .eq("is_active", true)
    .returns<HolidayRow[]>();
  if (e2) throw e2;

  // index for quick access
  const shiftMap = new Map<number, ShiftRow>();
  for (const s of shifts ?? []) shiftMap.set(s.day_of_week, s);

  const holidaySet = new Set<string>((hols ?? []).map((h) => h.date));
  return { shiftMap, holidaySet };
}

function isWorkingDay(d: Date, shiftMap: Map<number, ShiftRow>, holidaySet: Set<string>) {
  const dw = d.getUTCDay(); // 0..6
  const shift = shiftMap.get(dw);
  if (!shift || !shift.is_working_day) return false;
  if (holidaySet.has(ymd(d))) return false;
  return true;
}

function windowForDay(d: Date, shiftMap: Map<number, ShiftRow>) {
  const dw = d.getUTCDay();
  const s = shiftMap.get(dw);
  if (!s || !s.is_working_day) return null;
  const [sh, sm] = s.start_time.split(":").map(Number);
  const [eh, em] = s.end_time.split(":").map(Number);
  const start = setTime(d, sh, sm);
  const end = setTime(d, eh, em);
  return { start, end };
}

function nextWorkingStart(from: Date, shiftMap: Map<number, ShiftRow>, holidaySet: Set<string>) {
  let d = new Date(from);
  // If before today's window start -> jump to start
  for (let i = 0; i < 366; i++) {
    if (!isWorkingDay(d, shiftMap, holidaySet)) {
      d = addMin(startOfDayUTC(addMin(d, 24 * 60)), 0); // next day 00:00
      continue;
    }
    const win = windowForDay(d, shiftMap);
    if (!win) {
      d = addMin(startOfDayUTC(addMin(d, 24 * 60)), 0);
      continue;
    }
    if (d < win.start) return win.start;
    if (d >= win.start && d < win.end) return d; // inside window
    // after window -> next day
    d = addMin(startOfDayUTC(addMin(d, 24 * 60)), 0);
  }
  return from;
}

// Lay out a block of minutes, skipping outside windows
function scheduleBlock(from: Date, minutes: number,
  shiftMap: Map<number, ShiftRow>, holidaySet: Set<string>) {
  let cursor = nextWorkingStart(from, shiftMap, holidaySet);
  let remaining = minutes;
  let start: Date | null = null;

  while (remaining > 0) {
    const win = windowForDay(cursor, shiftMap)!;
    const usable = Math.max(0, (win.end.getTime() - cursor.getTime()) / 60_000);
    if (usable === 0) {
      cursor = nextWorkingStart(addMin(cursor, 1), shiftMap, holidaySet);
      continue;
    }
    if (!start) start = cursor;
    const spend = Math.min(usable, remaining);
    cursor = addMin(cursor, spend);
    remaining -= spend;
    if (remaining > 0) {
      // jump to next working window
      cursor = nextWorkingStart(addMin(cursor, 1), shiftMap, holidaySet);
    }
  }
  return { start: start!, end: cursor };
}

// ---------- DB helpers ----------
async function getQueueTails(
  sb: SupabaseClient,
): Promise<Map<string, Date>> {
  // Max end per production_stage_id in stage_time_slots
  const { data, error } = await sb
    .from("stage_time_slots")
    .select("production_stage_id, slot_end_time")
    .order("slot_end_time", { ascending: false });
  if (error) throw error;

  const map = new Map<string, Date>();
  for (const r of data ?? []) {
    if (!map.has(r.production_stage_id)) {
      map.set(r.production_stage_id, new Date(r.slot_end_time));
    }
  }
  return map;
}

async function selectCandidates(
  sb: SupabaseClient,
  req: RunRequest,
): Promise<JSI[]> {
  // Stages still to be scheduled for approved jobs
  let q = sb.from("job_stage_instances")
    .select(`id, job_id, production_stage_id, stage_order, dependency_group,
             scheduled_start_at, scheduled_end_at, scheduled_minutes,
             estimated_duration_minutes, created_at, status,
             production_stages(name)`)
    .in("status", ["pending", "queued"])
    // ensure job is approved (if you have a flag on production_jobs)
    .not("job_id", "is", null);

  if (req.onlyJobIds?.length) q = q.in("job_id", req.onlyJobIds);

  // onlyIfUnset -> nothing scheduled yet
  if (req.onlyIfUnset) {
    q = q.is("scheduled_start_at", null);
  }

  q = q.order("job_id", { ascending: true })
       .order("stage_order", { ascending: true })
       .order("created_at", { ascending: true });

  const { data, error } = await q;
  if (error) throw error;

  // massage stage name
  return (data ?? []).map((r: any) => ({
    id: r.id,
    job_id: r.job_id,
    production_stage_id: r.production_stage_id,
    stage_name: r.production_stages?.name ?? null,
    stage_order: r.stage_order,
    dependency_group: r.dependency_group,
    scheduled_start_at: r.scheduled_start_at,
    scheduled_end_at: r.scheduled_end_at,
    scheduled_minutes: r.scheduled_minutes,
    estimated_duration_minutes: r.estimated_duration_minutes,
    created_at: r.created_at,
    status: r.status,
  }));
}

// Latest end among earlier stages for a given stage instance
async function computePrevEnds(
  sb: SupabaseClient,
  jsis: JSI[],
): Promise<Map<string, Date | null>> {
  const ids = jsis.map(j => j.id);
  const map = new Map<string, Date | null>();
  if (ids.length === 0) return map;

  // For each JSI, compute the latest end among earlier stages in the same job part.
  // We can do it in SQL using a single query over all involved job_ids.
  const jobIds = [...new Set(jsis.map(j => j.job_id))];

  // Pull all earlier stage_end candidates for those jobs
  const { data, error } = await sb.rpc("get_prev_end_for_jsi_batch", {
    p_jsi_ids: ids,
  });
  // If your DB does not have that RPC yet, use a fallback per-row query
  if (error) {
    // Fallback (N queries) – still safe for the moderate batch sizes we pass
    for (const j of jsis) {
      const { data: rows, error: e2 } = await sb
        .from("job_stage_instances")
        .select(`id, stage_order, scheduled_end_at`)
        .eq("job_id", j.job_id)
        .lt("stage_order", j.stage_order ?? 9999)
        .order("stage_order", { ascending: true });
      if (e2) throw e2;

      let latest: Date | null = null;

      // end candidates: scheduled_end_at or last slot_end_time
      for (const r of rows ?? []) {
        let end: Date | null = r.scheduled_end_at ? new Date(r.scheduled_end_at) : null;
        if (!end) {
          const { data: slot, error: es } = await sb
            .from("stage_time_slots")
            .select("slot_end_time")
            .eq("stage_instance_id", r.id)
            .order("slot_end_time", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (es) throw es;
          if (slot?.slot_end_time) end = new Date(slot.slot_end_time);
        }
        if (end && (!latest || end > latest)) latest = end;
      }
      map.set(j.id, latest);
    }
    return map;
  }

  // If you implement the RPC, return rows like: { jsi_id, prev_end }
  for (const r of data ?? []) {
    map.set(r.jsi_id, r.prev_end ? new Date(r.prev_end) : null);
  }
  return map;
}

function minutesFor(j: JSI): number {
  return (
    (j.estimated_duration_minutes ?? 0) ||
    (j.scheduled_minutes ?? 0) ||
    1
  );
}

async function scheduleNow(
  sb: SupabaseClient,
  req: RunRequest,
): Promise<{ jobs_considered: number; scheduled: number; applied: { updated: number } }> {
  const { shiftMap, holidaySet } = await loadCalendar(sb);

  // optional wipe all
  if (req.nuclear || req.wipeAll) {
    const { error } = await sb.from("stage_time_slots").delete().neq("production_stage_id", null);
    if (error) throw error;
    // also clear scheduled_* timestamps so "onlyIfUnset" finds work
    await sb.from("job_stage_instances")
      .update({ scheduled_start_at: null, scheduled_end_at: null })
      .in("status", ["pending", "queued"]);
  }

  // base start
  let baseStart = new Date();
  if (req.startFrom) {
    baseStart = toDate(req.startFrom + "T00:00:00Z");
  }
  baseStart = nextWorkingStart(baseStart, shiftMap, holidaySet);

  // queue tails per resource
  const tails = await getQueueTails(sb);

  const jsis = await selectCandidates(sb, req);
  if (jsis.length === 0) {
    return { jobs_considered: 0, scheduled: 0, applied: { updated: 0 } };
  }

  // prev_end per jsi
  const prevEndMap = await computePrevEnds(sb, jsis);

  // group by dependency_group (for rendezvous) & by production_stage_id (queue)
  const byGroup = new Map<string, JSI[]>();
  for (const j of jsis) {
    if (j.dependency_group) {
      const key = j.dependency_group;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(j);
    }
  }

  // rendezvous time per group: max(prev_end of each member)
  const groupReady = new Map<string, Date>();
  for (const [key, members] of byGroup) {
    let latest: Date | null = null;
    for (const m of members) {
      const pe = prevEndMap.get(m.id) ?? null;
      if (pe && (!latest || pe > latest)) latest = pe;
    }
    if (latest) groupReady.set(key, latest);
  }

  // schedule each stage
  let scheduled = 0;

  for (const j of jsis) {
    // respect onlyIfUnset
    if (req.onlyIfUnset && j.scheduled_start_at) continue;

    const durationMin = minutesFor(j);

    // earliest from: base start, queue tail on the resource, own prev_end, and group rendezvous (if any)
    const prevEnd = prevEndMap.get(j.id) ?? null;
    const groupGate = j.dependency_group ? groupReady.get(j.dependency_group) ?? null : null;
    const qTail = tails.get(j.production_stage_id) ?? null;

    let earliest = baseStart;
    if (prevEnd && prevEnd > earliest) earliest = prevEnd;
    if (groupGate && groupGate > earliest) earliest = groupGate;
    if (qTail && qTail > earliest) earliest = qTail;

    // move to next working minute if needed
    earliest = nextWorkingStart(earliest, shiftMap, holidaySet);

    // allocate across shift windows
    const block = scheduleBlock(earliest, durationMin, shiftMap, holidaySet);

    // write slot
    const ins = {
      production_stage_id: j.production_stage_id,
      stage_instance_id: j.id,
      slot_start_time: fmt(block.start),
      slot_end_time: fmt(block.end),
    };
    const { error: e1 } = await sb.from("stage_time_slots").insert(ins);
    if (e1) throw e1;

    // touch jsi timestamps (leave status unchanged)
    const { error: e2 } = await sb
      .from("job_stage_instances")
      .update({
        scheduled_start_at: fmt(block.start),
        scheduled_end_at: fmt(block.end),
        scheduled_minutes: durationMin,
      })
      .eq("id", j.id);
    if (e2) throw e2;

    // bump tail
    tails.set(j.production_stage_id, block.end);
    scheduled++;
  }

  const jobs_considered = new Set(jsis.map((j) => j.job_id)).size;
  return { jobs_considered, scheduled, applied: { updated: scheduled } };
}

// -------------- HTTP --------------
serve(async (req: Request) => {
  const headers = cors(new Headers({ "Content-Type": "application/json" }));
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    let body: RunRequest = {};
    try {
      body = await req.json();
    } catch {
      // allow empty body
    }

    // defaults
    body.commit ??= true;
    body.proposed ??= false;
    body.onlyIfUnset ??= false;
    body.nuclear ??= false;
    body.wipeAll ??= false;

    const result = await scheduleNow(sb, body);
    return new Response(JSON.stringify({ ok: true, ...result }), { headers, status: 200 });
  } catch (err: any) {
    console.error("scheduler-run fatal:", err);
    const msg = typeof err?.message === "string" ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      headers,
      status: 500,
    });
  }
});
