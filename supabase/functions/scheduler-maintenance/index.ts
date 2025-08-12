import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/*
  Scheduler maintenance utilities
  Actions:
    - reset_capacity: resets daily_stage_capacity.scheduled_minutes to 0 and nulls stage_workload_tracking.queue_ends_at from a given date (default today)
  Body: { action: 'reset_capacity', fromDate?: string }
*/
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const fromDate: string = body.fromDate || new Date().toISOString().slice(0, 10);

    if (action !== 'reset_capacity') {
      return new Response(JSON.stringify({ ok: false, error: 'Unsupported action' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // 1) Reset daily_stage_capacity from fromDate onward
    const { error: capErr } = await supabase
      .from('daily_stage_capacity')
      .update({ scheduled_minutes: 0, updated_at: new Date().toISOString() })
      .gte('date', fromDate);

    if (capErr) {
      return new Response(JSON.stringify({ ok: false, error: `capacity reset failed: ${capErr.message}` }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // 2) Null queue_ends_at and reset counters from fromDate onward
    const { error: qErr } = await supabase
      .from('stage_workload_tracking')
      .update({
        queue_ends_at: null,
        committed_hours: 0,
        available_hours: 8,
        queue_length_hours: 0,
        pending_jobs_count: 0,
        active_jobs_count: 0,
        updated_at: new Date().toISOString()
      })
      .gte('date', fromDate);

    if (qErr) {
      return new Response(JSON.stringify({ ok: false, error: `queue reset failed: ${qErr.message}` }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ ok: true, action, fromDate }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: any) {
    console.error('[scheduler-maintenance] error', e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'unknown' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
