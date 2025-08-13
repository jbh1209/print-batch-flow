// Auto-schedule approved jobs: finds jobs with completed proof and pending unscheduled stages,
// then invokes the existing scheduling engine to allocate them.
// CORS enabled. Supports manual invocation and cron.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  try {
    const startedAt = new Date().toISOString();

    // Read scheduler version flag (app_settings.setting_type = 'scheduler_version', product_type = 'global')
    const { data: cfg, error: cfgErr } = await supabase
      .from('app_settings')
      .select('sla_target_days')
      .eq('setting_type', 'scheduler_version')
      .eq('product_type', 'global')
      .maybeSingle();
    if (cfgErr) {
      console.warn('[auto-schedule-approved] failed to read scheduler_version, defaulting to v2', cfgErr.message);
    }
    const schedulerVersion = (cfg?.sla_target_days === 1) ? 'legacy' : 'v2';

    // 1) Find jobs whose PROOF stage is completed
    const { data: proofs, error: proofsError } = await supabase
      .from('job_stage_instances')
      .select('job_id, job_table_name, stage_order, production_stages(name)')
      .eq('job_table_name', 'production_jobs')
      .eq('status', 'completed')
      .filter('production_stages.name', 'ilike', '%proof%');

    if (proofsError) throw proofsError;

    const uniqueJobs = new Map<string, { job_id: string; stage_order: number }>();
    (proofs || []).forEach((p: any) => {
      if (!uniqueJobs.has(p.job_id)) uniqueJobs.set(p.job_id, { job_id: p.job_id, stage_order: p.stage_order || 0 });
    });

    let checked = 0; let scheduled = 0; const errors: string[] = [];

    // 2) For each job, see if there are unscheduled downstream stages; if so, schedule
    for (const { job_id, stage_order } of uniqueJobs.values()) {
      checked++;
      const { data: pending, error: pendErr } = await supabase
        .from('job_stage_instances')
        .select('id')
        .eq('job_id', job_id)
        .eq('job_table_name', 'production_jobs')
        .in('status', ['pending', 'active'])
        .is('scheduled_start_at', null);
      if (pendErr) { errors.push(`pending-q failed ${job_id}: ${pendErr.message}`); continue; }
      if (!pending || pending.length === 0) continue;

      // Use scheduler version flag: legacy -> legacy only, v2 -> v2 only (no fallback)
      let ok = false;
      if (schedulerVersion === 'legacy') {
        const { data: resp, error: legacyErr } = await supabase.functions.invoke('schedule-on-approval', {
          body: { job_id, job_table_name: 'production_jobs' }
        });
        if (legacyErr) { errors.push(`legacy invoke failed ${job_id}: ${legacyErr.message}`); continue; }
        ok = Boolean((resp as any)?.ok || (resp as any)?.success);
      } else {
        const { data: v2, error: v2Err } = await supabase.functions.invoke('schedule-v2', {
          body: { job_id, job_table_name: 'production_jobs' }
        });
        if (v2Err || !(v2 as any)?.ok) { errors.push(`v2 invoke failed ${job_id}: ${v2Err?.message || 'unknown'}`); continue; }
        ok = true;
      }
      if (ok) scheduled++;
    }

    const result = { ok: true, startedAt, checked, scheduled, errors };
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: any) {
    console.error('auto-schedule-approved error', e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'unknown' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
