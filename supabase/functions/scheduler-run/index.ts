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
    throw new Error(`Database connectivity failed: ${e.message}`);
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
      
      return {
        wroteSlots: result?.wrote_slots || 0,
        updatedJSI: result?.updated_jsi || 0,
        dryRun: !req.commit,
        violations: result?.violations || []
      };
      
    } else {
      // Reschedule all jobs using chunked processing to avoid timeouts
      console.log("Rescheduling all pending jobs with chunked processing");
      
      const startTime = req.startFrom ? new Date(req.startFrom).toISOString() : null;
      const pageSize = req.pageSize || 25; // Default chunk size
      
      // First, discover all eligible jobs that need scheduling
      const { data: eligibleJobs, error: jobsError } = await supabase
        .from('production_jobs')
        .select('id')
        .not('proof_approved_at', 'is', null)
        .neq('status', 'Completed');

      if (jobsError) {
        console.error('Error fetching eligible jobs:', jobsError);
        throw jobsError;
      }

      if (!eligibleJobs || eligibleJobs.length === 0) {
        console.log('No eligible jobs found for scheduling');
        return {
          wroteSlots: 0,
          updatedJSI: 0,
          dryRun: !req.commit,
          violations: []
        };
      }

      const jobIds = eligibleJobs.map(job => job.id);
      console.log(`Found ${jobIds.length} eligible jobs, processing in chunks of ${pageSize}`);

      // Process jobs in chunks to avoid timeouts
      let totalWroteSlots = 0;
      let totalUpdatedJSI = 0;
      let allViolations: any[] = [];

      for (let i = 0; i < jobIds.length; i += pageSize) {
        const chunk = jobIds.slice(i, i + pageSize);
        console.log(`Processing chunk ${Math.floor(i / pageSize) + 1}/${Math.ceil(jobIds.length / pageSize)} with ${chunk.length} jobs`);

        try {
          const { data: chunkResult, error: chunkError } = await supabase.rpc('scheduler_append_jobs', {
            p_job_ids: chunk,
            p_start_from: startTime,
            p_only_if_unset: !!req.onlyIfUnset
          });

          if (chunkError) {
            console.error(`Error processing chunk starting at index ${i}:`, chunkError);
            throw chunkError;
          }

          const result = Array.isArray(chunkResult) && chunkResult.length > 0 ? chunkResult[0] : chunkResult;
          
          totalWroteSlots += result?.wrote_slots || 0;
          totalUpdatedJSI += result?.updated_jsi || 0;
          
          if (result?.violations && Array.isArray(result.violations)) {
            allViolations.push(...result.violations);
          }

          console.log(`Chunk completed: wrote ${result?.wrote_slots || 0} slots, updated ${result?.updated_jsi || 0} JSI`);
          
        } catch (chunkError) {
          console.error(`Failed processing chunk starting at index ${i}:`, chunkError);
          // Continue with next chunk rather than failing entirely
        }
      }

      console.log(`Chunked processing complete: total wrote ${totalWroteSlots} slots, updated ${totalUpdatedJSI} JSI, ${allViolations.length} violations`);

      return {
        wroteSlots: totalWroteSlots,
        updatedJSI: totalUpdatedJSI,
        dryRun: !req.commit,
        violations: allViolations
      };
    }
    
  } catch (error) {
    console.error('Scheduler error:', error);
    throw error;
  }
}

// HTTP Handler
serve((req) =>
  withCors(req, async () => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout after 5 minutes")), 5 * 60 * 1000);
    });

    const schedulerPromise = (async () => {
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
  })
);
