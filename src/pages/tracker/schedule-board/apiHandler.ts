// tracker/schedule-board/apiHandler.ts
import { createClient } from '@supabase/supabase-js';
import { planSchedule, SchedulerInput } from './scheduler';

export async function runScheduler(query: URLSearchParams) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!supabaseUrl || !serviceKey) return { status: 500, body: { error: 'Missing SUPABASE env vars' } };

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: snap, error: exportErr } = await supabase.rpc('export_scheduler_input');
  if (exportErr) return { status: 500, body: { error: 'export_scheduler_input failed', detail: exportErr } };

  const input = snap as SchedulerInput;
  const { updates } = planSchedule(input);
  
  // Guard: Filter out any PROOF/DTP updates that may have slipped through
  const NON_SCHEDULABLE_STAGES = ['PROOF', 'DTP'];
  const schedulableUpdates = updates.filter(u => {
    const stageInstance = input.jobs
      .flatMap(j => j.stages)
      .find(s => s.id === u.id);
    return stageInstance && !NON_SCHEDULABLE_STAGES.some(ns => 
      stageInstance.stage_name.toUpperCase().includes(ns)
    );
  });

  const commit      = (query.get('commit') ?? 'true') === 'true';
  const proposed    = (query.get('proposed') ?? 'true') === 'true';
  const onlyIfUnset = (query.get('onlyIfUnset') ?? 'true') === 'true';

  let applied: any = { updated: 0 };
  if (commit && schedulableUpdates.length) {
    const { data, error } = await supabase.rpc('apply_stage_updates_safe', {
      updates: schedulableUpdates, commit: true, only_if_unset: onlyIfUnset, as_proposed: proposed
    });
    if (error) return { status: 500, body: { error: 'apply_stage_updates_safe failed', detail: error } };
    applied = data;
  }
  return { status: 200, body: { ok: true, scheduled: schedulableUpdates.length, applied, updates: schedulableUpdates } };
}
