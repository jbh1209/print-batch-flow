// Edge Function: scheduler-run
// Version 1.0 - Calls DB functions safely

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

// ---------- Config ----------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------- Types ----------
type UUID = string;

type ScheduleRequest = {
  commit?: boolean;         // do inserts or just simulate
  proposed?: boolean;       // (accepted but not used; kept for compatibility)
  onlyIfUnset?: boolean;    // skip a stage that already has slots
  nuclear?: boolean;        // (accepted, no destructive behavior here)
  wipeAll?: boolean;        // clear existing schedules first
  startFrom?: string | null;// floor start time (ISO)
  onlyJobIds?: UUID[];      // schedule for these jobs only
  pageSize?: number;        // (compatibility)
  resetActiveOverdue?: boolean; // NEW: reset overdue active stages before scheduling
};

// ---------- CORS ----------
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(object: any, init?: ResponseInit) {
  return new Response(JSON.stringify(object), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    ...init,
  })
}

function withCors(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    try {
      return await handler(req);
    } catch (error) {
      console.error('Handler error:', error);
      return json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

// ---------- Health Check ----------
async function healthCheck(supabase: any): Promise<boolean> {
  try {
    const { error } = await supabase.from('shift_schedules').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

// ---------- Core Scheduling ----------
async function schedule(supabase: any, req: ScheduleRequest) {
  console.log('=== SCHEDULER RUN V1.0 ===');
  console.log('Request:', req);

  // STEP 1: Optional reset of overdue active stages before scheduling
  if (req.resetActiveOverdue) {
    console.log('=== RESETTING OVERDUE ACTIVE STAGES ===');
    const { data: resetData, error: resetError } = await supabase.rpc('reset_overdue_active_instances');
    
    if (resetError) {
      console.error('Failed to reset overdue active stages:', resetError);
    } else {
      console.log('Reset results:', resetData);
    }
  }

  // Special case: specific job IDs with append scheduling
  if (req.onlyJobIds && req.onlyJobIds.length > 0) {
    console.log('=== APPEND MODE: Scheduling specific job IDs ===');
    
    const { data: appendResult, error: appendError } = await supabase
      .rpc('scheduler_append_jobs', {
        p_job_ids: req.onlyJobIds,
        p_start_from: req.startFrom || null,
        p_only_if_unset: req.onlyIfUnset ?? true
      });

    if (appendError) {
      console.error('Append scheduling error:', appendError);
      throw new Error(`Append scheduling failed: ${appendError.message}`);
    }

    console.log('Append result:', appendResult);
    return {
      ok: true,
      mode: 'append_jobs',
      scheduled: appendResult?.updated_jsi || 0,
      wrote_slots: appendResult?.wrote_slots || 0,
      job_ids: req.onlyJobIds
    };
  }

  // General rescheduling mode - Version 1.0 behavior
  console.log('=== GENERAL MODE: Full rescheduling (Version 1.0) ===');

  // Handle wipeAll if requested
  if (req.wipeAll) {
    console.log('Wiping existing schedules...');
    const { error: wipeError } = await supabase
      .rpc('clear_non_completed_scheduling_data');
    
    if (wipeError) {
      console.error('Wipe error:', wipeError);
      throw new Error(`Schedule wipe failed: ${wipeError.message}`);
    }
  }

  // Call Version 1.0 scheduler wrapper (routes reschedule_all to sequential_fixed) - NOW FIXED!
  console.log('Calling Version 1.0 scheduler: simple_scheduler_wrapper(reschedule_all)');
  const { data: wrapperResult, error: wrapperError } = await supabase
    .rpc('simple_scheduler_wrapper', { p_mode: 'reschedule_all' });

  if (wrapperError) {
    console.error('Scheduler wrapper error:', wrapperError);
    throw new Error(`Scheduler failed: ${wrapperError.message}`);
  }

  console.log('Version 1.0 scheduler result:', wrapperResult);

  return {
    ok: true,
    mode: 'reschedule_all',
    scheduled: wrapperResult?.scheduled_count || 0,
    wrote_slots: wrapperResult?.wrote_slots || 0,
    success: wrapperResult?.success || false,
    version: '1.0'
  };
}

// ---------- HTTP Server ----------
serve(withCors(async (req: Request) => {
  console.log(`${req.method} ${req.url}`);

  // Health check endpoint
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.pathname.endsWith('/ping')) {
      const isHealthy = await healthCheck(supabase);
      return json({ ok: isHealthy, status: isHealthy ? 'healthy' : 'unhealthy' });
    }
    return json({ ok: true, message: 'Scheduler-run Version 1.0 ready', version: '1.0' });
  }

  // Scheduling endpoint
  if (req.method === 'POST') {
    const body = await req.json() as ScheduleRequest;
    
    // Check health first
    const isHealthy = await healthCheck(supabase);
    if (!isHealthy) {
      return json({ ok: false, error: 'Database not available' }, { status: 503 });
    }

    // Normalize request parameters
    const normalizedRequest: ScheduleRequest = {
      commit: body.commit ?? true,
      proposed: body.proposed ?? false,
      onlyIfUnset: body.onlyIfUnset ?? true,
      nuclear: body.nuclear ?? false,
      wipeAll: body.wipeAll ?? false,
      startFrom: body.startFrom || null,
      onlyJobIds: body.onlyJobIds || [],
      pageSize: body.pageSize || 100,
      resetActiveOverdue: body.resetActiveOverdue ?? false
    };

    // Execute scheduling with timeout
    const timeoutMs = 5 * 60 * 1000; // 5 minutes
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Scheduling timeout')), timeoutMs)
    );

    try {
      const result = await Promise.race([
        schedule(supabase, normalizedRequest),
        timeoutPromise
      ]);
      
      return json(result);
    } catch (error: any) {
      console.error('Scheduling error:', error);
      return json({ 
        ok: false, 
        error: error.message || 'Scheduling failed',
        mode: 'error',
        version: '1.0'
      }, { status: 500 });
    }
  }

  return json({ error: 'Method not allowed' }, { status: 405 });
}));