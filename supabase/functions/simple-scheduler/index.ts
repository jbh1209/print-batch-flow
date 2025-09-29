// Minimal, robust scheduler-run wrapper.
// - CORS for browser calls
// - Safe JSON parsing
// - Sanitizes onlyJobIds to avoid "invalid input syntax for type uuid: """
// - Stubs actual scheduling so you can confirm 200s end-to-end first.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
async function runRealScheduler(
  sb: SupabaseClient,
  payload: Required<Pick<ScheduleRequest,
    "commit" | "proposed" | "onlyIfUnset" | "nuclear" | "startFrom" | "onlyJobIds">>,
): Promise<{ jobs_considered: number; scheduled: number; applied: { updated: number } }> {
  console.log('🚀 Running PARALLEL-AWARE scheduler with payload:', payload);
  
  // Only proceed if commit is true (dry run protection)
  if (!payload.commit) {
    console.log('⚠️ Dry run mode - no actual scheduling performed');
    return { jobs_considered: 0, scheduled: 0, applied: { updated: 0 } };
  }

  try {
    // Clear existing slots if nuclear/wipeAll requested
    if (payload.nuclear) {
      console.log('💥 Nuclear mode: clearing existing stage_time_slots...');
      const { error: clearError } = await sb
        .from('stage_time_slots')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (clearError) {
        console.error('❌ Error clearing slots:', clearError);
        throw clearError;
      }
    }

    // Call the parallel-aware scheduler function directly
    console.log('📅 Running simple_scheduler_wrapper(reschedule_all)...');
    
    const { data, error } = await sb.rpc('simple_scheduler_wrapper', {
      p_mode: 'reschedule_all'
    });

    if (error) {
      console.error('❌ Scheduler error:', error);
      throw error;
    }

    const core: any = Array.isArray(data) ? (data as any[])[0] ?? {} : (data as any) ?? {};
    const wroteSlots = core?.wrote_slots ?? core?.applied?.wrote_slots ?? 0;
    const updatedJsi = core?.updated_jsi ?? core?.applied?.updated ?? 0;

    console.log(`✅ Scheduler complete: ${wroteSlots} slots, ${updatedJsi} stage instances updated`);
    
    return {
      jobs_considered: updatedJsi,
      scheduled: wroteSlots,
      applied: { updated: updatedJsi }
    };
  } catch (error) {
    console.error('💥 Parallel scheduler execution failed:', error);
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
  const body = safeJson<any>(rawText) ?? {};

  // Hard requirement
  if (!("commit" in body)) {
    return badRequest("Body must include { commit: boolean, ... }");
  }

  // Sanitize inputs
  const onlyJobIds = sanitizeOnlyIds(body.onlyJobIds);
  const startFrom =
    typeof body.startFrom === "string" && body.startFrom.trim().length
      ? body.startFrom.trim()
      : undefined;

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
