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

    // 1) Find jobs whose PROOF stage is completed
    const { data: proofs, error: proofsError } = await supabase
      .from('job_stage_instances')
      .select('job_id, job_table_name, stage_order, production_stages!inner(name)')
      .eq('job_table_name', 'production_jobs')
      .eq('status', 'completed')
      .ilike('production_stages.name', '%proof%');

    if (proofsError) throw proofsError;

    const uniqueJobs = new Map<string, { job_id: string; stage_order: number }>();
    (proofs || []).forEach((p: any) => {
      if (!uniqueJobs.has(p.job_id)) uniqueJobs.set(p.job_id, { job_id: p.job_id, stage_order: p.stage_order || 0 });
    });

    let checked = 0; let scheduled = 0; const errors: string[] = [];

    console.log(`Found ${uniqueJobs.size} jobs with completed proof stages`);

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
      if (pendErr) { 
        errors.push(`pending-q failed ${job_id}: ${pendErr.message}`); 
        console.error(`Failed to check pending stages for job ${job_id}:`, pendErr);
        continue; 
      }
      if (!pending || pending.length === 0) {
        console.log(`Job ${job_id} already scheduled - skipping`);
        continue;
      }

      console.log(`Scheduling job ${job_id} with ${pending.length} unscheduled stages`);
      
      const { data: resp, error: invErr } = await supabase.functions.invoke('schedule-on-approval', {
        body: { job_id, job_table_name: 'production_jobs' }
      });
      if (invErr) { 
        errors.push(`invoke failed ${job_id}: ${invErr.message}`); 
        console.error(`Failed to invoke schedule-on-approval for job ${job_id}:`, invErr);
        continue; 
      }
      if ((resp as any)?.ok) {
        scheduled++;
        console.log(`Successfully scheduled job ${job_id}`);
      } else {
        errors.push(`schedule failed ${job_id}: ${(resp as any)?.error || 'unknown'}`);
        console.error(`Schedule-on-approval returned error for job ${job_id}:`, resp);
      }
    }

    const result = { ok: true, startedAt, checked, scheduled, errors };
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: any) {
    console.error('auto-schedule-approved error', e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'unknown' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
