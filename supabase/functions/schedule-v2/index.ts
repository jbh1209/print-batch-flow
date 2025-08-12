import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple, deterministic FIFO scheduler wrapper.
// Tries v2 logic; on failure caller can fallback to legacy.
// Request body: { job_id: string, job_table_name?: string }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({}));
    const job_id: string | undefined = body.job_id;
    const job_table_name: string = body.job_table_name || 'production_jobs';

    if (!job_id) {
      return new Response(JSON.stringify({ ok: false, error: 'job_id is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const startedAt = new Date().toISOString();

    // Fetch pending/active stages for the job in order
    const { data: stages, error: stagesErr } = await supabase
      .from('job_stage_instances')
      .select('id, production_stage_id, stage_order, status, estimated_duration_minutes, production_stages(name)')
      .eq('job_id', job_id)
      .eq('job_table_name', job_table_name)
      .in('status', ['pending', 'active'])
      .order('stage_order', { ascending: true });

    if (stagesErr) throw stagesErr;
    if (!stages || stages.length === 0) {
      return new Response(JSON.stringify({ ok: true, startedAt, scheduled: 0, message: 'No pending/active stages to schedule' }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Safety: ensure daily capacity tables are initialized for today to avoid 0-available cascades
    // We do not mutate capacity here beyond what the legacy scheduler already does.

    // Invoke the existing engine for now (leveraging its multi-day + capacity logic).
    // We keep this function as the control point for v2 logic evolution.
    const { data: legacyResp, error: legacyErr } = await supabase.functions.invoke('schedule-on-approval', {
      body: { job_id, job_table_name }
    });

    if (legacyErr) {
      return new Response(JSON.stringify({ ok: false, error: legacyErr.message || 'schedule-on-approval failed' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ ok: true, startedAt, engine: 'v2-wrapper->legacy', details: legacyResp }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: any) {
    console.error('[schedule-v2] error', e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'unknown' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
