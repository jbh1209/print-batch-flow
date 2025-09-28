/**
 * SCHEDULER EDGE FUNCTION - VERSION 20241227_1445
 * Date: December 27, 2024
 * Time: 14:45 UTC
 * PARALLEL PART ASSIGNMENT LOGIC FOR COVER/TEXT PROCESSING
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

interface ScheduleRequest {
  commit?: boolean;
  onlyIfUnset?: boolean;
  onlyJobIds?: string[];
  startFrom?: string;
}

interface ScheduleResponse {
  ok: boolean;
  request: ScheduleRequest;
  scheduled_count: number;
  wrote_slots: number;
  success: boolean;
  mode: string;
  version: string;
  error?: string;
  errorCode?: string;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing required environment variables');
}

const json = (data: unknown, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
};

const healthCheck = async (supabase: any): Promise<void> => {
  const { error } = await supabase.from('shift_schedules').select('count').limit(1);
  if (error) throw error;
};

const schedule = async (supabase: any, req: ScheduleRequest): Promise<ScheduleResponse> => {
  const normalized: ScheduleRequest = {
    commit: req.commit ?? true,
    onlyIfUnset: req.onlyIfUnset ?? false,
    onlyJobIds: req.onlyJobIds || undefined,
    startFrom: req.startFrom || undefined,
  };

  console.log(`🔄 SCHEDULER VERSION 20241227_1445: Starting with request:`, normalized);

  let result;
  
  try {
    if (normalized.onlyJobIds && normalized.onlyJobIds.length > 0) {
      // Append specific jobs using new parallel parts scheduler
      console.log(`🔄 SCHEDULER VERSION 20241227_1445: Appending ${normalized.onlyJobIds.length} specific jobs`);
      
      const { data, error } = await supabase.rpc('scheduler_append_jobs_20241227_1445', {
        p_job_ids: normalized.onlyJobIds,
        p_start_from: normalized.startFrom || null,
        p_only_if_unset: normalized.onlyIfUnset
      });

      if (error) {
        console.error('SCHEDULER VERSION 20241227_1445 append error:', error);
        
        // Handle database errors gracefully
        if (error.code === 'P0001') {
          return {
            ok: false,
            request: normalized,
            scheduled_count: 0,
            wrote_slots: 0,
            success: false,
            mode: 'parallel_parts',
            version: '20241227_1445',
            error: error.message,
            errorCode: 'LUNCH_BREAK_OVERLAP'
          };
        }
        throw error;
      }

      result = data?.[0] || {};
      console.log(`✅ SCHEDULER VERSION 20241227_1445: Append completed:`, result);
    } else {
      // Full reschedule using new parallel parts scheduler
      console.log(`🔄 SCHEDULER VERSION 20241227_1445: Full reschedule with parallel parts logic, startFrom: ${normalized.startFrom}`);
      
      const { data, error } = await supabase.rpc('simple_scheduler_wrapper_20241227_1445', {
        p_mode: 'reschedule_all',
        p_start_from: normalized.startFrom || null
      });

      if (error) {
        console.error('SCHEDULER VERSION 20241227_1445 reschedule error:', error);
        
        // Handle database errors gracefully
        if (error.code === 'P0001') {
          return {
            ok: false,
            request: normalized,
            scheduled_count: 0,
            wrote_slots: 0,
            success: false,
            mode: 'parallel_parts',
            version: '20241227_1445',
            error: error.message,
            errorCode: 'LUNCH_BREAK_OVERLAP'
          };
        }
        throw error;
      }

      result = data?.[0] || {};
      console.log(`✅ SCHEDULER VERSION 20241227_1445: Reschedule completed:`, result);
    }
  } catch (dbError: any) {
    console.error('SCHEDULER VERSION 20241227_1445 database exception:', dbError);
    
    // Handle specific database errors
    if (dbError.code === 'P0001' || dbError.message?.includes('overlaps lunch break')) {
      return {
        ok: false,
        request: normalized,
        scheduled_count: 0,
        wrote_slots: 0,
        success: false,
        mode: 'parallel_parts',
        version: '20241227_1445',
        error: dbError.message || 'Time slot overlaps lunch break (12:00-12:30)',
        errorCode: 'LUNCH_BREAK_OVERLAP'
      };
    }
    
    throw dbError;
  }

  return {
    ok: true,
    request: normalized,
    scheduled_count: result?.scheduled_count ?? 0,
    wrote_slots: result?.wrote_slots ?? 0,
    success: result?.success ?? true,
    mode: result?.mode ?? 'parallel_parts',
    version: result?.version ?? '20241227_1445'
  };
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Health check endpoint
    if (req.method === 'GET' && new URL(req.url).searchParams.get('ping') === '1') {
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      await healthCheck(supabase);
      return json({ status: 'healthy', version: '20241227_1445' });
    }

    // Only allow POST for scheduling
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const body: ScheduleRequest = await req.json();
    
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    await healthCheck(supabase);
    
    const response = await schedule(supabase, body);
    
    return json(response, 200);
  } catch (error) {
    console.error(`❌ SCHEDULER VERSION 20241227_1445 ERROR:`, error);
    return json({ 
      error: error instanceof Error ? error.message : String(error), 
      version: '20241227_1445',
      timestamp: new Date().toISOString()
    }, 500);
  }
});