/**
 * Supabase Edge Function: scheduler-run
 * 
 * Thin wrapper that routes scheduling requests to the proven database scheduler functions.
 * This eliminates the buggy JavaScript scheduler and uses the reliable SQL-based scheduler.
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

// Types for request/response
type ScheduleRequest = {
  commit?: boolean;
  proposed?: boolean;
  onlyIfUnset?: boolean;
  nuclear?: boolean;
  wipeAll?: boolean;
  startFrom?: string;
  onlyJobIds?: string[];
  pageSize?: number;
};

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = 
  Deno.env.get("SERVICE_ROLE_KEY") ?? 
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? 
  "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY.");
  throw new Error("Missing required environment variables");
}

// CORS headers
function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "*";
  const acrh = req.headers.get("Access-Control-Request-Headers") ?? 
    "authorization, apikey, x-client-info, content-type";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": acrh,
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
    "Content-Type": "application/json",
  };
}

function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: corsHeaders(req),
  });
}

async function withCors(req: Request, fn: () => Promise<Response>) {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }
    const res = await fn();
    const merged = new Headers(res.headers);
    Object.entries(corsHeaders(req)).forEach(([k, v]) => merged.set(k, v as string));
    return new Response(res.body, { status: res.status, headers: merged });
  } catch (e: any) {
    console.error("scheduler-run fatal:", e);
    const code = e?.code ?? e?.status ?? "500";
    const message = e?.message ?? String(e);
    return json(req, 500, { ok: false, code, message });
  }
}

// Health check
async function healthCheck(supabase: any): Promise<void> {
  try {
    const { error } = await supabase.from("shift_schedules").select("day_of_week").limit(1);
    if (error) throw error;
    console.log("Database connectivity check passed");
  } catch (e) {
    console.error("Health check failed:", e);
    throw new Error(`Database connectivity failed: ${(e as Error).message}`);
  }
}
// Core scheduling function that routes to database scheduler
async function schedule(supabase: any, req: ScheduleRequest) {
  console.log("Starting scheduler with request:", req);

  try {
    // Determine which scheduler function to call based on request type
    if (req.onlyJobIds && req.onlyJobIds.length > 0) {
      // Append specific jobs to schedule
      console.log(`Appending ${req.onlyJobIds.length} specific jobs to schedule`);
      
      const startTime = req.startFrom ? new Date(req.startFrom).toISOString() : null;
      
      const { data, error } = await supabase.rpc('scheduler_append_jobs', {
        p_job_ids: req.onlyJobIds,
        p_start_from: startTime,
        p_only_if_unset: !!req.onlyIfUnset
      });

      if (error) {
        console.error('Error calling scheduler_append_jobs:', error);
        throw error;
      }

      const result = Array.isArray(data) && data.length > 0 ? data[0] : data;
      
      // ENHANCED: Auto-trigger due date calculation for scheduled jobs  
      // For specific jobs, only update current due_date, preserve original_committed_due_date
      if (req.commit && req.onlyJobIds && req.onlyJobIds.length > 0) {
        try {
          console.log(`Triggering due date calculation for ${req.onlyJobIds.length} specific jobs...`);
          const { error: dueDateError } = await supabase.functions.invoke('calculate-due-dates', {
            body: {
              jobIds: req.onlyJobIds,
              tableName: 'production_jobs',
              priority: 'high',
              dualDateMode: false  // Only update current due_date
            }
          });
          
          if (dueDateError) {
            console.error('Due date calculation failed (non-fatal):', dueDateError);
          } else {
            console.log('Due dates updated successfully');
          }
        } catch (e) {
          console.error('Due date calculation error (non-fatal):', e);
        }
      }
      
      return {
        wroteSlots: result?.wrote_slots || 0,
        updatedJSI: result?.updated_jsi || 0,
        dryRun: !req.commit,
        violations: result?.violations || []
      };
      
    } else {
      // For reschedule all, use the PROVEN WORKING scheduler from Monday morning
      console.log("Using proven working scheduler: simple_scheduler_wrapper -> scheduler_resource_fill_optimized");
      
      if (req.wipeAll) {
        console.log('Wiping all existing schedule data...');
        const { error: wipeError } = await supabase.rpc('scheduler_truncate_slots');
        if (wipeError) {
          console.error('Error wiping schedule:', wipeError);
          throw wipeError;
        }
      }

      // Calculate proper start time using next_working_start
      let startTime = req.startFrom;
      if (!startTime) {
        // Get next working start time from database function
        const { data: nextWorkingData, error: nextWorkingError } = await supabase.rpc('next_working_start', {
          input_time: new Date().toISOString()
        });
        
        if (nextWorkingError) {
          console.error('Error getting next working start:', nextWorkingError);
          // Fallback to manual calculation
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(8, 0, 0, 0);
          startTime = tomorrow.toISOString();
        } else {
          startTime = nextWorkingData;
        }
      }

      console.log(`Using start time: ${startTime}`);

      // Use proven working scheduler: simple_scheduler_wrapper -> scheduler_resource_fill_optimized
      console.log('Calling proven working scheduler: simple_scheduler_wrapper');
      
      const { data, error } = await supabase.rpc('simple_scheduler_wrapper', {
        p_mode: 'reschedule_all'
      });

      if (error) {
        console.error('Error calling simple_scheduler_wrapper:', error);
        throw error;
      }

      // Handle response from working scheduler (returns different format)
      const resultData = Array.isArray(data) && data.length > 0 ? data[0] : data;

      // ENHANCED: Always trigger due date calculation for robust dual date system
      if (req.onlyJobIds && req.onlyJobIds.length > 0) {
        console.log(`🎯 Triggering due date calculation for ${req.onlyJobIds.length} specific jobs with dual date mode`);
        
        try {
          const dueDateResult = await supabase.functions.invoke('calculate-due-dates', {
            body: {
              jobIds: req.onlyJobIds,
              tableName: 'production_jobs',
              priority: 'high',
              includeTimingCalculation: true,
              dualDateMode: true,  // CRITICAL: Enable dual date tracking
              forceOriginalDateUpdate: true  // Force setting original date for new jobs
            }
          });
          
          if (dueDateResult.error) {
            console.error('⚠️ Due date calculation failed:', dueDateResult.error);
          } else {
            console.log('✅ Due date calculation completed:', dueDateResult.data);
          }
        } catch (error) {
          console.error('⚠️ Due date calculation error:', error);
        }
      }

      // ALWAYS trigger due date calculation for jobs that need original_committed_due_date
      console.log('🎯 Ensuring all proof-approved jobs have original_committed_due_date set');
      
      try {
        const { data: jobsNeedingOriginalDate } = await supabase
          .from('production_jobs')
          .select('id')
          .not('proof_approved_at', 'is', null)
          .is('original_committed_due_date', null);

        if (jobsNeedingOriginalDate && jobsNeedingOriginalDate.length > 0) {
          const jobIds = jobsNeedingOriginalDate.map((job: any) => job.id);
          console.log(`🔄 Setting original_committed_due_date for ${jobIds.length} jobs`);
          
          const dueDateResult = await supabase.functions.invoke('calculate-due-dates', {
            body: {
              jobIds: jobIds,
              tableName: 'production_jobs',
              priority: 'high',
              includeTimingCalculation: true,
              dualDateMode: true,
              forceOriginalDateUpdate: true  // Force setting original date
            }
          });
          
          if (dueDateResult.error) {
            console.error('⚠️ Original date setting failed:', dueDateResult.error);
          } else {
            console.log('✅ Original dates set successfully:', dueDateResult.data);
          }
        }
      } catch (error) {
        console.error('⚠️ Error checking for jobs needing original dates:', error);
      }
      
      return {
        wroteSlots: resultData?.wrote_slots || resultData?.scheduled_count || 0,
        updatedJSI: resultData?.updated_jsi || resultData?.scheduled_count || 0,
        scheduledCount: resultData?.scheduled_count || 0,
        success: resultData?.success || false,
        dryRun: !req.commit,
        violations: resultData?.violations || []
      };
    }
    
  } catch (error) {
    console.error('Scheduler error:', error);
    throw error;
  }
}

// HTTP Handler
serve((req) => {
  return withCors(req, async (): Promise<Response> => {
    const timeoutPromise: Promise<Response> = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout after 5 minutes")), 5 * 60 * 1000);
    });

    const schedulerPromise: Promise<Response> = (async () => {
      if (req.method === 'GET') {
        if (new URL(req.url).searchParams.get("ping") === "1") {
          return json(req, 200, { ok: true, pong: true, now: new Date().toISOString() });
        }
        return json(req, 200, { message: 'Scheduler service is running', timestamp: new Date().toISOString() });
      }
      
      if (req.method !== "POST") {
        return json(req, 405, { ok: false, error: "Method Not Allowed. Use POST for scheduling or GET for health check." });
      }

      const body = (await req.json().catch(() => ({}))) as ScheduleRequest;

      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
        global: { headers: { "x-client-info": "scheduler-run-v2" } },
      });

      await healthCheck(supabase);

      // Normalize request
      const normalized: ScheduleRequest = {
        commit: !!body.commit,
        proposed: !!body.proposed,
        onlyIfUnset: !!body.onlyIfUnset,
        nuclear: !!body.nuclear,
        wipeAll: !!body.wipeAll,
        startFrom: body.startFrom,
        onlyJobIds: Array.isArray(body.onlyJobIds) ? body.onlyJobIds : undefined,
        pageSize: (typeof body.pageSize === "number" && body.pageSize > 0) ? Math.min(1000, body.pageSize) : undefined,
      };

      const result = await schedule(supabase, normalized);

      return json(req, 200, {
        ok: true,
        request: normalized,
        ...result,
      });
    })();

    return Promise.race([schedulerPromise, timeoutPromise]);
  });
});
