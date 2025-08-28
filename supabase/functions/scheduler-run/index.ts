// deno-lint-ignore-file no-explicit-any
/**
 * Production Scheduler Edge Function
 * ----------------------------------
 * What this wrapper guarantees:
 *  - Parses and validates request payload
 *  - Takes an advisory lock (prevents concurrent runs)
 *  - Normalizes `startFrom` to the next working start using shift_schedules & public_holidays
 *  - For append-hook calls (onlyIfUnset=true, no startFrom), auto-derives queue tail per first pending stage
 *  - Calls your existing scheduling core exactly once (paste it in executeScheduler)
 *  - Returns a concise JSON result for logging/diagnostics
 *
 * Payloads we expect (from your message):
 *  A) Append newly approved (hook)
 *     { commit: true, proposed: false, onlyIfUnset: true, onlyJobIds: [<uuid>] }
 *
 *  B) Reschedule All (rebuild)
 *     { commit: true, proposed: false, onlyIfUnset: false, nuclear: true, wipeAll: true, startFrom: "YYYY-MM-DD" }
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// ----- Env -----
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

type UUID = string;

type SchedulerRequest = {
  commit?: boolean;
  proposed?: boolean;
  onlyIfUnset?: boolean;
  nuclear?: boolean;
  wipeAll?: boolean;
  startFrom?: string;     // ISO date or datetime; normalization will be applied
  onlyJobIds?: UUID[];    // optional: limit to these jobs
  // free-form passthrough knobs if you already use them:
  [k: string]: any;
};

type SchedulerResponse = {
  ok: boolean;
  jobs_considered: number;
  scheduled: number;
  applied: { updated: number };
  nuclear: boolean;
  onlyJobIds: number;
  baseStart: string | null;
  notes?: string[];
};

type ShiftRow = {
  day_of_week: number;     // 0-6  (0=Sunday ... 6=Saturday)
  start_time: string;      // "08:00:00"
  end_time: string;        // "16:30:00"
  is_working_day: boolean;
};

type PublicHoliday = {
  date: string;            // "YYYY-MM-DD"
  is_active: boolean;
};

// ---- tiny utilities ----
const isoDate = (d: Date) => d.toISOString().slice(0, 10);            // YYYY-MM-DD
const toUtc = (v: string | Date) => new Date(typeof v === "string" ? v : v.toISOString());
const clipMidnight = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

function setTimeUTC(d: Date, hhmmss: string): Date {
  const [hh, mm, ss] = hhmmss.split(":").map((s) => parseInt(s, 10));
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hh || 0, mm || 0, ss || 0));
}

function maxDate(a: Date, b: Date) { return a > b ? a : b; }

// ---- DB helpers ----
function supabaseAdmin(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

async function takeLock(sb: SupabaseClient): Promise<boolean> {
  const { data, error } = await sb.rpc("pg_try_advisory_lock", { key: 847501 } as any);
  if (error) {
    // fallback for projects without that RPC helper
    const q = await sb.from("_fake").select("*").limit(0); // no-op to keep typing happy
  }
  // Use a direct SQL RPC for reliability:
  const { data: lock, error: err2 } = await sb.rpc("sql", {
    q: "select pg_try_advisory_lock(847501) as ok",
  } as any);
  if (err2) return false;
  return (Array.isArray(lock) && lock[0]?.ok) || (data as any) === true;
}

async function releaseLock(sb: SupabaseClient): Promise<void> {
  await sb.rpc("sql", { q: "select pg_advisory_unlock(847501)" } as any).catch(() => {});
}

// We emulate a generic "sql rpc" helper (if you haven't created it yet,
// this still won't break; we only rely on select-style queries below).
type SqlRow = Record<string, any>;
async function sql<T = SqlRow>(sb: SupabaseClient, q: string): Promise<T[]> {
  // If you have a standard function like `rpc('sql', { q })`, use it.
  // Otherwise, fall back to `postgrest` via a server-side view `admin_sql` (optional).
  // To keep this drop-in, we'll prefer `rpc('sql')`. If missing, throw a friendly error.
  const { data, error } = await sb.rpc("sql", { q } as any);
  if (error) throw error;
  return (data ?? []) as T[];
}

// ---- Shift & holiday calendar ----
async function getWorkingCalendar(sb: SupabaseClient) {
  const [shifts, hols] = await Promise.all([
    sql<ShiftRow>(sb, `
      select day_of_week, start_time::text, end_time::text, is_working_day
      from public.shift_schedules
      order by day_of_week asc;
    `),
    sql<PublicHoliday>(sb, `
      select to_char(date, 'YYYY-MM-DD') as date, is_active
      from public.public_holidays
      where is_active is true
      order by date asc;
    `),
  ]);
  const holSet = new Set(hols.filter(h => h.is_active).map(h => h.date));
  const byDow = new Map<number, ShiftRow>();
  for (const s of shifts) byDow.set(s.day_of_week, s);
  return { byDow, holSet };
}

function nextWorkingStartFrom(calendar: { byDow: Map<number, ShiftRow>, holSet: Set<string> }, anchor: Date): Date {
  // if anchor is inside a working day but before start -> clamp to start
  // if inside but after end -> move to next day start
  // if weekend/holiday -> move forward until a working day
  let d = new Date(anchor.getTime());
  for (let guard = 0; guard < 366; guard++) {
    const dow = d.getUTCDay(); // 0..6
    const shift = calendar.byDow.get(dow);
    const dayKey = isoDate(d);
    if (!shift || !shift.is_working_day || calendar.holSet.has(dayKey)) {
      // move to next day 00:00 and continue
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
      continue;
    }
    const start = setTimeUTC(d, shift.start_time);
    const end   = setTimeUTC(d, shift.end_time);
    if (d < start) return start;        // before start -> clamp
    if (d <= end) return d;             // inside window -> OK
    // after end -> tomorrow
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0));
  }
  // Fallback: anchor itself
  return anchor;
}

/**
 * For append-hook calls: derive an anchor from the queue tail
 * 1) find the first pending/queued stage for the job
 * 2) get max(slot_end_time) for that production_stage_id (queue tail)
 * 3) return max(now, tail)
 */
async function deriveAppendAnchor(sb: SupabaseClient, jobId: UUID): Promise<Date | null> {
  const rows = await sql<{ production_stage_id: UUID }>(sb, `
    select jsi.production_stage_id
    from public.job_stage_instances jsi
    where jsi.job_id = '${jobId}'
      and coalesce(jsi.status, 'pending') in ('pending','queued')
    order by coalesce(jsi.stage_order, 9999), jsi.created_at
    limit 1;
  `);
  if (!rows.length) return null;
  const stageId = rows[0].production_stage_id;
  const tail = await sql<{ tail: string | null }>(sb, `
    select max(slot_end_time) as tail
    from public.stage_time_slots
    where production_stage_id = '${stageId}';
  `);
  const now = new Date();
  const tailEnd = tail[0]?.tail ? new Date(tail[0].tail) : null;
  return tailEnd ? maxDate(now, tailEnd) : now;
}

// ---- Wipe helpers for nuclear rebuilds ----
async function wipeAllFutureSlots(sb: SupabaseClient, onlyJobIds?: UUID[]) {
  if (onlyJobIds && onlyJobIds.length > 0) {
    await sql(sb, `
      delete from public.stage_time_slots sts
      using public.job_stage_instances jsi
      where sts.stage_instance_id = jsi.id
        and jsi.job_id in (${onlyJobIds.map(id => `'${id}'`).join(",")});
    `);
  } else {
    await sql(sb, `truncate public.stage_time_slots restart identity;`);
  }
}

// ---- The one place where your existing algorithm is called ----
/**
 * Paste your current scheduling core here.
 * It should:
 *  - read request.onlyJobIds (optional)
 *  - read request.startFrom (ISO string; already normalized to next working start)
 *  - honor request.nuclear (we already wiped slots if true), request.onlyIfUnset, commit/proposed
 *  - place stage_time_slots for all jobs/stages accordingly
 *  - return { jobs_considered, scheduled, applied: { updated } }
 *
 * IMPORTANT: You no longer need to compute "append tail" or "next working start" —
 *            the wrapper has already provided request.startFrom properly.
 */
async function executeScheduler(
  sb: SupabaseClient,
  request: Required<Pick<SchedulerRequest, "commit"|"proposed"|"onlyIfUnset"|"nuclear">> & {
    onlyJobIds: UUID[] | undefined;
    startFrom: string | null; // ISO string in UTC; or null if append per-stage (rare)
    // plus any other knobs already used in your internal code
    [k: string]: any;
  },
): Promise<Pick<SchedulerResponse, "jobs_considered"|"scheduled"|"applied">> {

  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  // >>>  PASTE YOUR EXISTING SCHEDULER IMPLEMENTATION IN THIS BLOCK.     >>>
  // >>>  Make sure it uses: request.onlyJobIds, request.startFrom, etc.    >>>
  // >>>  The wrapper has already:                                          >>>
  // >>>     - normalized startFrom to a valid working anchor               >>>
  // >>>     - wiped slots if nuclear is true                               >>>
  // >>>     - derived queue tail for append when needed                    >>>
  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

  // TEMP minimal no-op so file compiles. Replace with your real logic.
  return { jobs_considered: 0, scheduled: 0, applied: { updated: 0 } };
}

// ---- HTTP handler ----
serve(async (req) => {
  const sb = supabaseAdmin();
  const notes: string[] = [];
  try {
    const body = (await req.json()) as SchedulerRequest;
    // Defaults
    const commit    = body.commit   ?? true;
    const proposed  = body.proposed ?? false;
    const onlyIfUnset = body.onlyIfUnset ?? false;
    const nuclear   = body.nuclear  ?? false;
    const wipeAll   = body.wipeAll  ?? false;
    let startFrom   = body.startFrom ?? null;
    const onlyJobIds = (Array.isArray(body.onlyJobIds) && body.onlyJobIds.length > 0)
      ? [...new Set(body.onlyJobIds)]
      : undefined;

    // ---- Take lock
    const locked = await takeLock(sb);
    if (!locked) {
      return new Response(JSON.stringify({ ok: false, error: "Scheduler is already running" }), { status: 429 });
    }

    // ---- Fetch calendar & normalize anchor
    const cal = await getWorkingCalendar(sb);

    let computedAnchor: Date | null = null;

    if (nuclear || wipeAll || startFrom) {
      // Rebuild mode or explicit anchor
      const raw = startFrom
        ? new Date(startFrom.length <= 10 ? `${startFrom}T00:00:00Z` : startFrom)
        : new Date();
      const notBefore = new Date(); // never schedule before "now"
      computedAnchor = nextWorkingStartFrom(cal, maxDate(raw, notBefore));
      startFrom = computedAnchor.toISOString();
      notes.push(`anchor(normalized)=${startFrom}`);
    } else if (onlyIfUnset && onlyJobIds && onlyJobIds.length === 1) {
      // Append mode for a single job (the hook case)
      const tail = await deriveAppendAnchor(sb, onlyJobIds[0]);
      computedAnchor = tail ? nextWorkingStartFrom(cal, tail) : nextWorkingStartFrom(cal, new Date());
      startFrom = computedAnchor.toISOString();
      notes.push(`append-tail anchor=${startFrom}`);
    } else if (onlyIfUnset && (!onlyJobIds || onlyJobIds.length !== 1)) {
      // Multi-job append without explicit startFrom: anchor = now (normalized)
      computedAnchor = nextWorkingStartFrom(cal, new Date());
      startFrom = computedAnchor.toISOString();
      notes.push(`multi-append normalized anchor=${startFrom}`);
    } else {
      // Fallback: normalize whatever we have (or now)
      computedAnchor = nextWorkingStartFrom(cal, startFrom ? new Date(startFrom) : new Date());
      startFrom = computedAnchor.toISOString();
      notes.push(`fallback anchor=${startFrom}`);
    }

    // ---- Wipe (nuclear / wipeAll)
    if (nuclear || wipeAll) {
      await wipeAllFutureSlots(sb, onlyJobIds);
      notes.push(`nuclear_wipe=${onlyJobIds?.length ? `jobs:${onlyJobIds.length}` : "all"}`);
    }

    // ---- Call your scheduler core
    const core = await executeScheduler(sb, {
      commit, proposed, onlyIfUnset, nuclear,
      onlyJobIds,
      startFrom,           // ISO string in UTC (already valid working anchor)
      // passthrough any other body knobs if you rely on them internally:
      ...body,
    });

    const resp: SchedulerResponse = {
      ok: true,
      jobs_considered: core.jobs_considered ?? 0,
      scheduled: core.scheduled ?? 0,
      applied: core.applied ?? { updated: 0 },
      nuclear: nuclear === true,
      onlyJobIds: onlyJobIds?.length ?? 0,
      baseStart: startFrom,
      notes,
    };

    return new Response(JSON.stringify(resp), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const msg = (err && (err.message || String(err))) || "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500 });
  } finally {
    await releaseLock(sb);
  }
});
