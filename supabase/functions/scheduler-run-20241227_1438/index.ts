/**
 * SCHEDULER EDGE FUNCTION - VERSION 20241227_1438
 * Date: December 27, 2024
 * Time: 14:38 UTC
 * Clean, minimal scheduler implementation with versioning
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Request types
type ScheduleRequest = {
  commit?: boolean;
  onlyIfUnset?: boolean;
  onlyJobIds?: string[];
  startFrom?: string;
};

// Environment setup
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

// Health check
async function healthCheck(supabase: any): Promise<void> {
  const { error } = await supabase.from("shift_schedules").select("day_of_week").limit(1);
  if (error) throw error;
}

// Core scheduling function - CLEAN VERSION 20241227_1438
async function schedule(supabase: any, req: ScheduleRequest) {
  console.log("SCHEDULER VERSION 20241227_1438: Starting with request:", req);

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
        dryRun: !req.commit,
        version: "20241227_1438"
      };
      
    } else {
      // Route to simple_scheduler_wrapper for full reschedule
      console.log("Using CLEAN SCHEDULER VERSION 20241227_1438: simple_scheduler_wrapper -> scheduler_reschedule_all_sequential_fixed_20241227_1437");
      
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
        violations: result?.violations || [],
        version: "20241227_1438"
      };
    }
    
  } catch (error) {
    console.error('SCHEDULER VERSION 20241227_1438 error:', error);
    throw error;
  }
}

// HTTP Handler - CLEAN VERSION 20241227_1438
serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check
    if (req.method === 'GET') {
      if (new URL(req.url).searchParams.get("ping") === "1") {
        return json(200, { 
          ok: true, 
          pong: true, 
          version: "20241227_1438",
          now: new Date().toISOString() 
        });
      }
      return json(200, { 
        message: 'CLEAN SCHEDULER VERSION 20241227_1438 service is running', 
        timestamp: new Date().toISOString() 
      });
    }
    
    if (req.method !== "POST") {
      return json(405, { ok: false, error: "Method Not Allowed" });
    }

    const body = (await req.json().catch(() => ({}))) as ScheduleRequest;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      global: { headers: { "x-client-info": "scheduler-run-v20241227_1438" } },
    });

    // Quick health check
    await healthCheck(supabase);

    // Normalize request - CLEAN & SIMPLE
    const normalized: ScheduleRequest = {
      commit: !!body.commit,
      onlyIfUnset: !!body.onlyIfUnset,
      startFrom: body.startFrom,
      onlyJobIds: Array.isArray(body.onlyJobIds) ? body.onlyJobIds : undefined,
    };

    const result = await schedule(supabase, normalized);

    return json(200, {
      ok: true,
      request: normalized,
      ...result,
    });

  } catch (error: any) {
    console.error("SCHEDULER VERSION 20241227_1438 failed:", error);
    return json(500, { 
      ok: false, 
      version: "20241227_1438", 
      error: error?.message ?? String(error) 
    });
  }
});