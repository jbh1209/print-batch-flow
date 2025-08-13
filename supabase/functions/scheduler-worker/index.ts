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

  const log = (...args: any[]) => console.log('[scheduler-worker]', ...args);

  try {
    const body = await req.json().catch(() => ({}));
    const job_id: string | undefined = body.job_id;
    const job_table_name: string = body.job_table_name || 'production_jobs';
    const batchSize: number = Number(body.batch_size || 10);

    if (job_id) {
      // Process a specific job immediately
      const { data, error } = await supabase.functions.invoke('schedule-v2', {
        body: { job_id, job_table_name },
      });
      if (error) {
        log('schedule-v2 error for job', job_id, error.message);
        return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      // Mark any queue items for this job as processed
      await supabase
        .from('schedule_job_queue')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('job_id', job_id)
        .eq('processed', false);

      return new Response(JSON.stringify({ ok: true, processed: [{ job_id }], result: data }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Otherwise, process oldest unprocessed queue items
    const { data: queue, error: qErr } = await supabase
      .from('schedule_job_queue')
      .select('id, job_id, job_table_name')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (qErr) throw qErr;

    const processed: any[] = [];
    for (const item of queue || []) {
      const jid = item.job_id as string;
      const jtbl = (item.job_table_name as string) || 'production_jobs';

      const { error: schedErr } = await supabase.functions.invoke('schedule-v2', {
        body: { job_id: jid, job_table_name: jtbl },
      });

      if (schedErr) {
        log('schedule-v2 error for job', jid, schedErr.message);
        await supabase
          .from('schedule_job_queue')
          .update({ attempts: (1 as any), updated_at: new Date().toISOString() })
          .eq('id', item.id);
        continue;
      }

      await supabase
        .from('schedule_job_queue')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('id', item.id);

      processed.push({ job_id: jid });

      // Deduplicate any other unprocessed rows for this job
      await supabase
        .from('schedule_job_queue')
        .delete()
        .eq('job_id', jid)
        .eq('processed', false);
    }

    return new Response(JSON.stringify({ ok: true, processed }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: any) {
    console.error('[scheduler-worker] error', e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'unknown' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
