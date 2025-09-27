/**
 * Supabase Edge Function: scheduler-run (VERSION 1.0 - SEPTEMBER 24TH RESTORATION)
 * 
 * Minimal wrapper that routes scheduling requests to the proven database scheduler functions.
 * PROTECTED - DO NOT MODIFY WITHOUT AUTHORIZATION
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

// Simple request types
type ScheduleRequest = {
  commit?: boolean;
  onlyIfUnset?: boolean;
  onlyJobIds?: string[];
  startFrom?: string;
};

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing required environment variables");
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Content-Type": "application/json",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: corsHeaders,
  });
}

// Simple health check
async function healthCheck(supabase: any): Promise<void> {
  const { error } = await supabase.from("shift_schedules").select("day_of_week").limit(1);
  if (error) throw error;
}

// Core scheduling function - SIMPLIFIED VERSION 1.0
async function schedule(supabase: any, req: ScheduleRequest) {
  console.log("VERSION 1.0 Scheduler starting with request:", req);

  try {
    if (req.onlyJobIds && req.onlyJobIds.length > 0) {
      // Route to scheduler_append_jobs for specific jobs
      console.log(`Appending ${req.onlyJobIds.length} specific jobs to schedule`);
      
      const { data, error } = await supabase.rpc('scheduler_append_jobs', {
        p_job_ids: req.onlyJobIds,
        p_start_from: req.startFrom ? new Date(req.startFrom).toISOString() : null,
        p_only_if_unset: !!req.onlyIfUnset
      });

      if (error) {
        console.error('Error calling scheduler_append_jobs:', error);
        throw error;
      }

      const result = Array.isArray(data) && data.length > 0 ? data[0] : data;
      
      return {
        wroteSlots: result?.wrote_slots || 0,
        updatedJSI: result?.updated_jsi || 0,
        success: true,
        dryRun: !req.commit
      };
      
    } else {
      // Route to simple_scheduler_wrapper for full reschedule
      // CRITICAL: This calls scheduler_reschedule_all_sequential_fixed (VERSION 1.0)
      console.log("Using VERSION 1.0 scheduler: simple_scheduler_wrapper -> scheduler_reschedule_all_sequential_fixed");
      
      const { data, error } = await supabase.rpc('simple_scheduler_wrapper', {
        p_mode: 'reschedule_all'
      });

      if (error) {
        console.error('Error calling simple_scheduler_wrapper:', error);
        throw error;
      }

      const result = Array.isArray(data) && data.length > 0 ? data[0] : data;

      return {
        wroteSlots: result?.wrote_slots || result?.scheduled_count || 0,
        updatedJSI: result?.updated_jsi || result?.scheduled_count || 0,
        scheduledCount: result?.scheduled_count || 0,
        success: result?.success || false,
        dryRun: !req.commit,
        violations: result?.violations || []
      };
    }
    
  } catch (error) {
    console.error('VERSION 1.0 Scheduler error:', error);
    throw error;
  }
}

// HTTP Handler - SIMPLIFIED VERSION 1.0
serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check
    if (req.method === 'GET') {
      if (new URL(req.url).searchParams.get("ping") === "1") {
        return json(200, { ok: true, pong: true, version: "1.0", now: new Date().toISOString() });
      }
      return json(200, { message: 'VERSION 1.0 Scheduler service is running', timestamp: new Date().toISOString() });
    }
    
    if (req.method !== "POST") {
      return json(405, { ok: false, error: "Method Not Allowed" });
    }

    const body = (await req.json().catch(() => ({}))) as ScheduleRequest;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      global: { headers: { "x-client-info": "scheduler-run-v1.0" } },
    });

    // Quick health check
    await healthCheck(supabase);

    // Normalize request - SIMPLIFIED
    const normalized: ScheduleRequest = {
      commit: !!body.commit,
      onlyIfUnset: !!body.onlyIfUnset,
      startFrom: body.startFrom,
      onlyJobIds: Array.isArray(body.onlyJobIds) ? body.onlyJobIds : undefined,
    };

    const result = await schedule(supabase, normalized);

    return json(200, {
      ok: true,
      version: "1.0",
      request: normalized,
      ...result,
    });

  } catch (error: any) {
    console.error("VERSION 1.0 Scheduler failed:", error);
    return json(500, { 
      ok: false, 
      version: "1.0", 
      error: error?.message ?? String(error) 
    });
  }
});