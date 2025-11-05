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

    console.log('Calling scheduler_resource_fill_optimized...');
    
    const { data, error } = await sb.rpc('scheduler_resource_fill_optimized');

    if (error) {
      console.error('Scheduler error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Scheduler failed', 
          message: error.message,
          details: error 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = data as SchedulerResultType;
    
    console.log('Scheduler completed:', result);

    return new Response(
      JSON.stringify({
        success: true,
        wrote_slots: result.wrote_slots,
        updated_jsi: result.updated_jsi,
        violations: result.violations || [],
        scheduled: result.wrote_slots,
        applied: { updated: result.updated_jsi }
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
