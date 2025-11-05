// Simple scheduler - calls Oct 24th working scheduler_resource_fill_optimized
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SchedulerResultType {
  wrote_slots: number;
  updated_jsi: number;
  violations: any[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sb = createClient(supabaseUrl, serviceKey);

    console.log('Calling simple_scheduler_wrapper...');
    
    const { data, error } = await sb.rpc('simple_scheduler_wrapper', {
      p_division: null,
      p_start_from: null
    });

    // Always return 200 with structured response
    if (error) {
      console.error('Scheduler RPC error:', error);
      return new Response(
        JSON.stringify({ 
          success: false,
          message: error.message,
          details: error,
          wrote_slots: 0,
          updated_jsi: 0,
          violations: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if wrapper returned success: false
    if (data && data.success === false) {
      console.warn('Scheduler reported failure:', data);
      return new Response(
        JSON.stringify({
          success: false,
          message: data.error || 'Scheduler reported a failure',
          wrote_slots: data.wrote_slots || 0,
          updated_jsi: data.updated_jsi || 0,
          violations: Array.isArray(data.violations) ? data.violations : []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scheduler completed successfully:', data);

    return new Response(
      JSON.stringify({
        success: true,
        wrote_slots: data.wrote_slots || 0,
        updated_jsi: data.updated_jsi || 0,
        violations: Array.isArray(data.violations) ? data.violations : [],
        scheduled: data.wrote_slots || 0,
        applied: { updated: data.updated_jsi || 0 }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Unhandled error:', err);
    return new Response(
      JSON.stringify({ 
        error: 'Unhandled error in edge function', 
        message: err instanceof Error ? err.message : String(err) 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
