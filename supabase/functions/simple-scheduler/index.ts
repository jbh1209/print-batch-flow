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

// ---------- Database-centric scheduler ----------
function calculateStartFrom(): string | undefined {
  const now = new Date();
  
  // Get current time in SA timezone (UTC+2)
  const saOffset = 2 * 60; // SA is UTC+2
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const saTime = new Date(utc + (saOffset * 60000));
  
  // If it's after 17:00 SA time or weekend, move to next working day at 08:00
  if (saTime.getHours() >= 17 || saTime.getDay() === 0 || saTime.getDay() === 6) {
    const nextDay = new Date(saTime);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(8, 0, 0, 0);
    
    // Skip weekends
    while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    
    // Convert back to UTC for ISO string
    const utcNext = nextDay.getTime() - (saOffset * 60000);
    return new Date(utcNext).toISOString();
  }
  
  return undefined; // Use current time
}

async function runRealScheduler(
  sb: SupabaseClient,
  payload: Required<Pick<ScheduleRequest,
    "commit" | "proposed" | "onlyIfUnset" | "nuclear" | "startFrom" | "onlyJobIds">>,
): Promise<{ jobs_considered: number; scheduled: number; applied: { updated: number } }> {
  console.log('🚀 Running STANDARDIZED database scheduler with payload:', payload);
  
  // Only proceed if commit is true (dry run protection)
  if (!payload.commit) {
    console.log('⚠️ Dry run mode - no actual scheduling performed');
    return { jobs_considered: 0, scheduled: 0, applied: { updated: 0 } };
  }

  try {
    if (payload.onlyJobIds && payload.onlyJobIds.length > 0) {
      // Append specific jobs to schedule using STANDARDIZED function
      console.log(`📋 Scheduling specific jobs: ${payload.onlyJobIds.length} jobs`);
      
      const { data, error } = await sb.rpc('scheduler_append_jobs', {
        p_job_ids: payload.onlyJobIds,
        p_start_from: payload.startFrom || null,
        p_only_if_unset: payload.onlyIfUnset
      });

      if (error) {
        console.error('❌ Append jobs error:', error);
        throw error;
      }

      const result = data[0];
      console.log(`✅ Append complete: ${result.updated_jsi} stages updated, ${result.wrote_slots} slots created`);
      
      return {
        jobs_considered: payload.onlyJobIds.length,
        scheduled: result.updated_jsi,
        applied: { updated: result.updated_jsi }
      };
      
    } else {
      // CRITICAL FIX: Use wrapper function instead of direct call for consistency
      console.log('📅 Running full reschedule using simple_scheduler_wrapper...');
      
      const { data, error } = await sb.rpc('simple_scheduler_wrapper', {
        p_mode: 'reschedule_all'
      });

      if (error) {
        console.error('❌ Reschedule error:', error);
        throw error;
      }

      console.log(`✅ Reschedule complete via wrapper:`, data);
      
      return {
        jobs_considered: data.scheduled_count || 0,
        scheduled: data.scheduled_count || 0,
        applied: { updated: data.scheduled_count || 0 }
      };
    }
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
  const bodyAny = safeJson<any>(rawText) ?? {};

  // Hard requirement
  if (!("commit" in bodyAny)) {
    return badRequest("Body must include { commit: boolean, ... }");
  }

  // Sanitize inputs  
  const onlyJobIds = sanitizeOnlyIds(bodyAny.onlyJobIds);
  const startFrom =
    typeof bodyAny.startFrom === "string" && bodyAny.startFrom.trim().length
      ? bodyAny.startFrom.trim()
      : calculateStartFrom(); // CRITICAL FIX: Auto-calculate proper start time

  // Build sanitized payload (fill defaults)
  const sanitizedPayload: Required<Pick<ScheduleRequest,
    "commit" | "proposed" | "onlyIfUnset" | "nuclear" | "startFrom" | "onlyJobIds">> = {
    commit: !!bodyAny.commit,
    proposed: !!bodyAny.proposed,
    onlyIfUnset: !!bodyAny.onlyIfUnset,
    nuclear: !!(bodyAny.nuclear || bodyAny.wipeAll),
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
