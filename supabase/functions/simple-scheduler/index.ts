// Minimal, robust scheduler-run wrapper.
// - CORS for browser calls
// - Safe JSON parsing
// - Sanitizes onlyJobIds to avoid "invalid input syntax for type uuid: """
// - Stubs actual scheduling so you can confirm 200s end-to-end first.

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// ---------- CORS ----------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

// ---------- Types ----------
type ScheduleRequest = {
  commit: boolean;
  proposed?: boolean;
  onlyIfUnset?: boolean;
  nuclear?: boolean;
  wipeAll?: boolean;
  startFrom?: string | null;
  onlyJobIds?: string[] | null;   // may be [""] from UI; we sanitize below
  baseStart?: string | null;      // reserved (append)
};

type ScheduleResult = {
  ok: true;
  message: string;
  jobs_considered: number;
  scheduled: number;
  applied: { updated: number };
  sanitized: {
    onlyJobIds: string[] | undefined;
    startFrom: string | undefined;
  };
};

type ErrorResult = { ok: false; error: string };

// ---------- Utils ----------
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUUID(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v.trim());
}

function sanitizeOnlyIds(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = raw
    .filter((x) => typeof x === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0) // remove "", "   "
    .filter((s) => isUUID(s));   // keep only valid UUIDs
  return ids.length ? ids : undefined;
}

function safeJson<T = unknown>(s: string): T | undefined {
  try {
    return JSON.parse(s) as T;
  } catch {
    return undefined;
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function badRequest(msg: string) {
  return json({ ok: false, error: msg } satisfies ErrorResult, 400);
}

function serverError(msg: string, extra?: unknown) {
  console.error("[scheduler-run] error:", msg, extra ?? "");
  return json({ ok: false, error: msg } satisfies ErrorResult, 500);
}

// Small helper to normalize RPC results (array or object)
function firstRow<T = any>(data: any): T {
  if (Array.isArray(data)) return (data[0] ?? {}) as T;
  return (data ?? {}) as T;
}

// ---------- Database-centric scheduler ----------
async function runRealScheduler(
  sb: SupabaseClient,
  payload: Required<Pick<ScheduleRequest,
    "commit" | "proposed" | "onlyIfUnset" | "nuclear" | "startFrom" | "onlyJobIds">>,
): Promise<{ jobs_considered: number; scheduled: number; applied: { updated: number } }> {
  console.log('🚀 Running TS parallel-aware scheduler with payload:', payload);

  // ---- Types local to the scheduler ----
  type Shift = { id: string; day_of_week: number; shift_start_time: string; shift_end_time: string; is_working_day: boolean };
  type Holiday = { date: string; name?: string };
  type StageInput = {
    id: string;                 // stage_instance_id
    job_id: string;
    job_table: string;          // 'production_jobs'
    status: string;
    stage_name: string;
    stage_group?: string | null;
    stage_order: number;
    setup_minutes?: number | null;
    estimated_minutes?: number | null;
    scheduled_start_at?: string | null;
    scheduled_end_at?: string | null;
    scheduled_minutes?: number | null;
    schedule_status?: string | null;
    production_stage_id: string;
    part_assignment?: string | null; // 'covers' | 'text' | 'both' | null
    category_id?: string | null;
  };
  type JobInput = {
    job_id: string;
    wo_number?: string;
    customer_name?: string;
    quantity?: number;
    due_date?: string | null;
    proof_approved_at?: string | null;
    estimated_run_minutes?: number;
    stages: StageInput[];
  };
  type ExportPayload = {
    meta: any;
    shifts: Shift[];
    holidays: Holiday[];
    routes: any[];
    jobs: JobInput[];
  };

  function isExportPayload(v: any): v is ExportPayload {
    return v && Array.isArray(v.jobs) && Array.isArray(v.shifts) && Array.isArray(v.holidays);
  }

  // ---- Time helpers (UTC-based) ----
  const shiftsByDOW = new Map<number, Shift[]>();
  function buildShiftIndex(shifts: Shift[]) {
    shiftsByDOW.clear();
    for (const s of shifts) {
      const arr = shiftsByDOW.get(s.day_of_week) || [];
      arr.push(s);
      shiftsByDOW.set(s.day_of_week, arr);
    }
  }

  const holidaySet = new Set<string>();
  function buildHolidayIndex(holidays: Holiday[]) {
    holidaySet.clear();
    for (const h of holidays) holidaySet.add(String(h.date));
  }

  function ymd(d: Date) { return d.toISOString().slice(0,10); }

  function parseTimeOnDate(d: Date, timeHHMMSS: string): Date {
    // time like '08:00:00'
    const [hh, mm, ss] = timeHHMMSS.split(':').map((x) => parseInt(x, 10));
    const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hh || 0, mm || 0, ss || 0));
    return dt;
  }

  function getShiftWindow(date: Date): { start: Date; end: Date } | null {
    const dow = date.getUTCDay();
    const shifts = shiftsByDOW.get(dow) || [];
    // choose the first working shift for the day
    const s = shifts.find((x) => x.is_working_day);
    if (!s) return null;
    return { start: parseTimeOnDate(date, s.shift_start_time), end: parseTimeOnDate(date, s.shift_end_time) };
  }

  function isWorkingDay(date: Date): boolean {
    const win = getShiftWindow(date);
    if (!win) return false;
    if (holidaySet.has(ymd(date))) return false;
    return true;
  }

  function nextDate(date: Date): Date {
    const n = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
    return n;
  }

  function alignToNextWorkStart(ts: Date): Date {
    let d = new Date(ts);
    for (let i = 0; i < 14; i++) { // hard stop after 2 weeks
      const win = getShiftWindow(d);
      if (!win || !isWorkingDay(d)) {
        d = nextDate(d);
        continue;
      }
      if (d < win.start) return new Date(win.start);
      if (d >= win.end) { d = nextDate(d); continue; }
      return d; // within working window
    }
    return d;
  }

  function addWorkMinutes(start: Date, minutes: number): Date {
    let remaining = Math.max(0, Math.floor(minutes));
    let cursor = alignToNextWorkStart(start);
    for (let i = 0; i < 60 && remaining > 0; i++) { // cap iterations for safety
      const win = getShiftWindow(cursor);
      if (!win || !isWorkingDay(cursor)) { cursor = nextDate(cursor); continue; }
      const available = Math.floor((win.end.getTime() - cursor.getTime()) / 60000);
      if (available <= 0) { cursor = nextDate(cursor); continue; }
      if (remaining <= available) {
        return new Date(cursor.getTime() + remaining * 60000);
      }
      remaining -= available;
      cursor = nextDate(cursor); // move to next day start (alignToNextWorkStart will be applied on next loop)
      cursor = alignToNextWorkStart(cursor);
    }
    return cursor;
  }

  function toDateOr(dateStr?: string | null): Date | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  // ---- Optional wipe when nuclear ----
  if (payload.nuclear) {
    try {
      console.log('🧨 Nuclear requested – clearing non-completed scheduling data...');
      const { error: wipeErr } = await sb.rpc('clear_non_completed_scheduling_data');
      if (wipeErr) console.warn('⚠️ Wipe error (continuing):', wipeErr);
    } catch (e) {
      console.warn('⚠️ Wipe threw (continuing):', e);
    }
  }

  // Special path: append/specific jobs still via RPC (keeps identical behavior)
  if (payload.onlyJobIds && payload.onlyJobIds.length > 0) {
    console.log(`📋 Scheduling specific jobs via RPC: ${payload.onlyJobIds.length} jobs`);
    const { data, error } = await sb.rpc('scheduler_append_jobs', {
      p_job_ids: payload.onlyJobIds,
      p_start_from: payload.startFrom || null,
      p_only_if_unset: payload.onlyIfUnset,
    });
    if (error) throw error;
    const row = firstRow(data);
    const updated = Number((row as any)?.updated_jsi ?? (row as any)?.scheduled_count ?? (row as any)?.updated ?? 0);
    return { jobs_considered: payload.onlyJobIds.length, scheduled: updated, applied: { updated } };
  }

  // ---- Main TS scheduler path ----
  try {
    const { data: raw, error: expErr } = await sb.rpc('export_scheduler_input');
    if (expErr) {
      console.error('❌ export_scheduler_input error:', expErr);
      throw expErr;
    }
    const exp: any = raw;
    const payloadJson: ExportPayload | undefined = (typeof exp === 'object' ? exp : undefined) as any;
    if (!isExportPayload(payloadJson)) {
      console.error('❌ Invalid export payload shape:', payloadJson);
      throw new Error('Invalid export payload shape');
    }

    buildShiftIndex(payloadJson.shifts || []);
    buildHolidayIndex(payloadJson.holidays || []);

    const baseStart = toDateOr(payload.startFrom) || new Date();
    const globalBase = alignToNextWorkStart(baseStart);

    // resource tails per stage_group
    const resourceTail = new Map<string, Date>();

    // Filter jobs if onlyJobIds provided (we're in full path; but keep safety)
    const targetJobIds = new Set<string>((payload.onlyJobIds || []) as any);
    const jobs = (payloadJson.jobs || []).filter(j => !targetJobIds.size || targetJobIds.has(j.job_id));

    type BranchFinish = { covers: Date; text: Date };
    const branchFinishByJob = new Map<string, BranchFinish>();

    let scheduled = 0;
    let wroteSlots = 0;
    let considered = 0;

    // Iterate jobs FIFO by proof_approved_at then by stage_order
    jobs.sort((a, b) => {
      const ap = toDateOr(a.proof_approved_at)?.getTime() || 0;
      const bp = toDateOr(b.proof_approved_at)?.getTime() || 0;
      if (ap !== bp) return ap - bp;
      return a.job_id.localeCompare(b.job_id);
    });

    for (const job of jobs) {
      const jobApproved = toDateOr(job.proof_approved_at);
      const jobBaseStart = alignToNextWorkStart(new Date(Math.max(globalBase.getTime(), (jobApproved?.getTime() || 0))));

      const bf: BranchFinish = { covers: jobBaseStart, text: jobBaseStart };
      branchFinishByJob.set(job.job_id, bf);

      // sort stages by stage_order asc
      const stages = (job.stages || []).slice().sort((s1, s2) => (s1.stage_order - s2.stage_order));

      for (const s of stages) {
        // onlyIfUnset: skip already scheduled
        if (payload.onlyIfUnset && (s.scheduled_start_at || s.scheduled_end_at)) {
          continue;
        }

        // Compute duration
        const setup = Number(s.setup_minutes ?? 0) || 0;
        const est = Number(s.scheduled_minutes ?? s.estimated_minutes ?? 0) || 0;
        const duration = Math.max(5, setup + est);

        // Stage group resource tail key
        const sg = (s.stage_group || 'default').toString().toLowerCase();

        // Dependency: branch convergence
        const part = (s.part_assignment || '').toString().toLowerCase();
        let depTime = jobBaseStart;
        if (part === 'covers') depTime = bf.covers;
        else if (part === 'text') depTime = bf.text;
        else if (part === 'both') depTime = new Date(Math.max(bf.covers.getTime(), bf.text.getTime()));

        const rTail = resourceTail.get(sg) || jobBaseStart;
        const start0 = new Date(Math.max(jobBaseStart.getTime(), depTime.getTime(), rTail.getTime()));
        const start = alignToNextWorkStart(start0);
        const end = addWorkMinutes(start, duration);

        considered++;

        if (payload.commit) {
          // Update job_stage_instances
          const upd = {
            scheduled_start_at: start.toISOString(),
            scheduled_end_at: end.toISOString(),
            scheduled_minutes: duration,
            schedule_status: payload.proposed ? 'proposed' : 'scheduled',
            updated_at: new Date().toISOString(),
          } as any;
          const { error: uErr } = await sb.from('job_stage_instances').update(upd).eq('id', s.id);
          if (uErr) console.warn('⚠️ update jsi error:', uErr, s.id);
          else scheduled++;

          // Insert time slot (best-effort)
          const slot = {
            job_id: s.job_id,
            job_table_name: s.job_table || 'production_jobs',
            production_stage_id: s.production_stage_id,
            stage_instance_id: s.id,
            slot_start_time: start.toISOString(),
            duration_minutes: duration,
          } as any;
          const { error: insErr } = await sb.from('stage_time_slots').insert([slot]);
          if (insErr) console.warn('⚠️ insert slot error (continuing):', insErr, slot);
          else wroteSlots++;
        } else {
          // Dry run: count theoretical schedule
          scheduled++;
          wroteSlots++;
        }

        // Advance tails
        resourceTail.set(sg, end);
        if (part === 'covers') bf.covers = end;
        else if (part === 'text') bf.text = end;
        else if (part === 'both') { const m = new Date(Math.max(bf.covers.getTime(), bf.text.getTime(), end.getTime())); bf.covers = m; bf.text = m; }
      }
    }

    console.log('✅ TS scheduler complete:', { considered, scheduled, wroteSlots });
    return { jobs_considered: considered, scheduled, applied: { updated: scheduled } };
  } catch (error) {
    console.error('💥 Scheduler execution failed:', error);
    throw error;
  }
}

// ---------- HTTP entry ----------
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return badRequest("POST only");
  }

  // Parse body safely
  const rawText = await req.text();
  const body = safeJson<ScheduleRequest>(rawText) ?? {} as any;

  // Hard requirement
  if (!("commit" in body)) {
    return badRequest("Body must include { commit: boolean, ... }");
  }

  // Sanitize inputs
  const onlyJobIds = sanitizeOnlyIds(body.onlyJobIds);
  // Accept startFrom or baseStart from UI
  const startFromRaw =
    typeof (body as any).startFrom === "string" && (body as any).startFrom.trim().length
      ? (body as any).startFrom.trim()
      : (typeof (body as any).baseStart === "string" && (body as any).baseStart.trim().length
          ? (body as any).baseStart.trim()
          : undefined);
  const startFrom = startFromRaw;

  // Build sanitized payload (fill defaults)
  const sanitizedPayload: Required<Pick<ScheduleRequest,
    "commit" | "proposed" | "onlyIfUnset" | "nuclear" | "startFrom" | "onlyJobIds">> = {
    commit: !!body.commit,
    proposed: !!body.proposed,
    onlyIfUnset: !!body.onlyIfUnset,
    nuclear: !!(body.nuclear || body.wipeAll),
    startFrom,
    onlyJobIds: onlyJobIds || null,
  };

  // Supabase client (service key, runs server-side)
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return serverError("Missing SUPABASE_URL or SERVICE_ROLE_KEY env variables");
  }
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { "x-client-info": "scheduler-run/edge" } },
  });

  try {
    // If nuclear/wipeAll was requested, you can clear slots up front.
    // (Safe to keep as no-op until you connect the real engine.)
    if (sanitizedPayload.nuclear) {
      // Example pattern if you choose to wipe here:
      // await sb.from("stage_time_slots").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    // >>> Call your actual scheduler here (currently a stub):
    const core = await runRealScheduler(sb, sanitizedPayload);

    const result: ScheduleResult = {
      ok: true,
      message: "scheduler-run OK",
      jobs_considered: core.jobs_considered,
      scheduled: core.scheduled,
      applied: core.applied,
      sanitized: { onlyJobIds, startFrom },
    };
    return json(result, 200);
  } catch (err) {
    return serverError("Unhandled scheduler error", err);
  }
});
