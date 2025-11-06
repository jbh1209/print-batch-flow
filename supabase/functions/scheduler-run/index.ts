import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

interface SchedulerRunRequest {
  commit?: boolean;
  proposed?: boolean;
  onlyIfUnset?: boolean;
  onlyJobIds?: string[] | null;
  baseStart?: string | null;
  debug?: boolean;
  wipeAll?: boolean;
}

interface SchedulerRunResult {
  wrote_slots: number;
  updated_jsi: number;
  violations: any[];
  jobCount: number;
  commit: boolean;
  onlyIfUnset: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET requests gracefully (health check)
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ 
        ok: true, 
        function: "scheduler-run", 
        status: "healthy",
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Parse request body with safe defaults
    let body: SchedulerRunRequest = {};
    try {
      body = await req.json();
    } catch (parseError) {
      console.warn("Failed to parse JSON body, using defaults:", parseError);
    }

    const commit = body.commit ?? true;
    const proposed = body.proposed ?? false;
    const onlyIfUnset = body.onlyIfUnset ?? false; // Default to reflow
    const onlyJobIds = body.onlyJobIds ?? null;
    const baseStart = body.baseStart ?? null;
    const debug = body.debug ?? false;
    const wipeAll = body.wipeAll ?? false;

    console.log("scheduler-run invoked:", {
      commit,
      proposed,
      onlyIfUnset,
      debug,
      wipeAll,
      jobCount: onlyJobIds?.length ?? "all",
    });

    // Step 1: Optionally wipe all slots (destructive, requires explicit opt-in)
    if (wipeAll && !onlyJobIds && commit) {
      console.log("🗑️ Wiping all slots (wipeAll=true, no job filter)...");
      const { error: truncateError } = await supabase.rpc("scheduler_truncate_slots");
      if (truncateError) {
        console.error("scheduler_truncate_slots failed:", truncateError);
        return new Response(
          JSON.stringify({ error: "Failed to truncate slots", detail: truncateError }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("✅ All slots truncated");
    }

    // Step 2: If specific jobs + reflow, delete their existing slots
    if (onlyJobIds && onlyJobIds.length > 0 && !onlyIfUnset && commit) {
      console.log(`🗑️ Deleting slots for ${onlyJobIds.length} jobs (reflow mode)...`);
      const { error: deleteError } = await supabase.rpc("scheduler_delete_slots_for_jobs", {
        p_job_ids: onlyJobIds,
      });
      if (deleteError) {
        console.error("scheduler_delete_slots_for_jobs failed:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to delete job slots", detail: deleteError }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("✅ Job slots deleted");
    }

    // Step 3: Run the scheduler
    console.log("🔄 Running scheduler_append_jobs...");
    const { data: scheduleData, error: scheduleError } = await supabase.rpc("scheduler_append_jobs", {
      p_job_ids: onlyJobIds,
      p_only_if_unset: onlyIfUnset,
    });

    if (scheduleError) {
      console.error("scheduler_append_jobs failed:", scheduleError);
      return new Response(
        JSON.stringify({ error: "Scheduler failed", detail: scheduleError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = Array.isArray(scheduleData) ? scheduleData[0] : scheduleData;
    const wroteSlots = result?.wrote_slots ?? 0;
    const updatedJsi = result?.updated_jsi ?? 0;

    console.log("✅ Scheduler completed:", { wroteSlots, updatedJsi });

    // Step 4: Get validation results
    console.log("🔍 Running validation...");
    const { data: validationData, error: validationError } = await supabase.rpc(
      "validate_job_scheduling_precedence"
    );

    const violations = validationError ? [] : (validationData || []);
    console.log(`✅ Validation complete: ${violations.length} notes`);

    const response: SchedulerRunResult = {
      wrote_slots: wroteSlots,
      updated_jsi: updatedJsi,
      violations,
      jobCount: onlyJobIds?.length ?? 0,
      commit,
      onlyIfUnset,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("scheduler-run error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
