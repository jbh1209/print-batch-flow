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

      const row = firstRow(data);
      const updated = Number((row as any)?.updated_jsi ?? (row as any)?.scheduled_count ?? (row as any)?.updated ?? 0);
      const wrote = Number((row as any)?.wrote_slots ?? 0);

      console.log(`✅ Append complete: ${updated} stages updated, ${wrote} slots created`, { raw: row });
      
      return {
        jobs_considered: payload.onlyJobIds.length,
        scheduled: updated,
        applied: { updated }
      };
      
    } else {
      // Full reschedule all using STANDARDIZED scheduler_resource_fill_optimized
      console.log('📅 Running full reschedule using scheduler_resource_fill_optimized...');
      
      const { data, error } = await sb.rpc('simple_scheduler_wrapper', { p_mode: 'reschedule_all' });

      if (error) {
        console.error('❌ Reschedule error (wrapper):', error);
        throw error;
      }

      const row = firstRow(data);
      // simple_scheduler_wrapper returns { scheduled_count, wrote_slots, success }
      const scheduledCount = Number((row as any)?.scheduled_count ?? (row as any)?.updated_jsi ?? (row as any)?.updated ?? 0);
      const wrote = Number((row as any)?.wrote_slots ?? 0);

      console.log(`✅ Reschedule complete (wrapper): ${scheduledCount} stages updated, ${wrote} slots created`, { raw: row });
      
      return {
        jobs_considered: scheduledCount, // Best approximation
        scheduled: scheduledCount,
        applied: { updated: scheduledCount }
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
