import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Deterministic FIFO scheduler (v2)
// Request body: { job_id: string, job_table_name?: string }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const log = (...args: any[]) => console.log('[schedule-v2]', ...args);

  try {
    const body = await req.json().catch(() => ({}));
    const job_id: string | undefined = body.job_id;
    const job_table_name: string = body.job_table_name || 'production_jobs';

    if (!job_id) {
      return new Response(JSON.stringify({ ok: false, error: 'job_id is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const now = new Date();

    // Fetch pending/active stages for the job in order
    const { data: stages, error: stagesErr } = await supabase
      .from('job_stage_instances')
      .select('id, production_stage_id, stage_order, status, estimated_duration_minutes, scheduled_start_at, scheduled_end_at')
      .eq('job_id', job_id)
      .eq('job_table_name', job_table_name)
      .in('status', ['pending', 'active'])
      .order('stage_order', { ascending: true });

    if (stagesErr) throw stagesErr;
    if (!stages || stages.length === 0) {
      return new Response(JSON.stringify({ ok: true, scheduled: [], message: 'No pending/active stages to schedule' }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Utilities
    const toDateStr = (d: Date) => d.toISOString().slice(0, 10);
    const startOfWorkingDay = (d: Date) => {
      const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8, 0, 0, 0)); // 08:00 UTC
      return x;
    };
    const endOfWorkingDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 16, 30, 0, 0)); // 16:30 UTC (510 min)
    const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;
    const nextWorkingDayStart = (d: Date) => {
      const nd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8, 0, 0, 0));
      do {
        nd.setUTCDate(nd.getUTCDate() + 1);
      } while (isWeekend(nd));
      return startOfWorkingDay(nd);
    };

    const scheduled: Array<{ stage_instance_id: string; start: string; end: string; minutes: number }> = [];

    let dependencyEnd: Date | null = null;

    for (const stage of stages) {
      const stageId = stage.id as string;
      const prodStageId = stage.production_stage_id as string;
      const estimated = Math.max(0, Number(stage.estimated_duration_minutes ?? 60));

      let remaining = estimated;
      let stageStart: Date | null = null;
      let stageEnd: Date | null = null;

      // Earliest allowed start: dependency end or now
      let earliest = dependencyEnd && dependencyEnd > now ? new Date(dependencyEnd) : new Date(now);

      // Ensure we start on a working day/time
      if (isWeekend(earliest) || earliest >= endOfWorkingDay(earliest)) {
        earliest = nextWorkingDayStart(earliest);
      } else if (earliest < startOfWorkingDay(earliest)) {
        earliest = startOfWorkingDay(earliest);
      }

      let cursor = new Date(earliest);

      while (remaining > 0) {
        // Normalize to working period for current day
        if (isWeekend(cursor)) {
          cursor = nextWorkingDayStart(cursor);
        }
        const dayStart = startOfWorkingDay(cursor);
        const dayEnd = endOfWorkingDay(cursor);
        if (cursor >= dayEnd) {
          cursor = nextWorkingDayStart(cursor);
          continue;
        }

        const dateStr = toDateStr(cursor);

        // Ensure daily capacity row exists and get available minutes
        const { data: capData, error: capErr } = await supabase
          .rpc('get_or_create_daily_capacity', { p_stage_id: prodStageId, p_date: dateStr, p_capacity_minutes: 510 });
        if (capErr) throw capErr;
        const capRow = Array.isArray(capData) ? capData[0] : capData; // handle RPC return shape
        const availableMinutes = Math.max(0, Number(capRow?.available_minutes ?? 510));

        // Fetch or init workload tracking for this day
        let { data: swt, error: swtErr } = await supabase
          .from('stage_workload_tracking')
          .select('id, queue_ends_at, committed_hours, available_hours')
          .eq('production_stage_id', prodStageId)
          .eq('date', dateStr)
          .maybeSingle();
        if (swtErr) throw swtErr;

        if (!swt) {
          const insertPayload: any = {
            production_stage_id: prodStageId,
            date: dateStr,
            queue_ends_at: dayStart.toISOString(),
            committed_hours: 0,
            available_hours: 8,
            queue_length_hours: 0,
            pending_jobs_count: 0,
            active_jobs_count: 0,
            calculated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          const { data: newSwt, error: insErr } = await supabase
            .from('stage_workload_tracking')
            .insert(insertPayload)
            .select('id, queue_ends_at, committed_hours, available_hours')
            .maybeSingle();
          if (insErr) throw insErr;
          swt = newSwt as any;
        }

        // Normalize queue end time
        let queueEndsAt = swt.queue_ends_at ? new Date(swt.queue_ends_at) : dayStart;
        if (queueEndsAt < dayStart) queueEndsAt = dayStart;

        const candidateStart = new Date(Math.max(queueEndsAt.getTime(), dayStart.getTime(), earliest.getTime()));
        if (candidateStart >= dayEnd) {
          cursor = nextWorkingDayStart(cursor);
          continue;
        }

        const minutesUntilDayEnd = Math.max(0, Math.floor((dayEnd.getTime() - candidateStart.getTime()) / 60000));
        const freeToday = Math.max(0, Math.min(availableMinutes, minutesUntilDayEnd));

        if (freeToday <= 0) {
          // No room today - move to next working day
          cursor = nextWorkingDayStart(cursor);
          continue;
        }

        const alloc = Math.max(0, Math.min(remaining, freeToday));
        const segEnd = new Date(candidateStart.getTime() + alloc * 60000);

        // Update workload tracking
        const newCommittedHours = Math.max(0, Number(swt.committed_hours || 0) + alloc / 60);
        const { error: updSwtErr } = await supabase
          .from('stage_workload_tracking')
          .update({
            queue_ends_at: segEnd.toISOString(),
            committed_hours: newCommittedHours,
            updated_at: new Date().toISOString(),
          })
          .eq('production_stage_id', prodStageId)
          .eq('date', dateStr);
        if (updSwtErr) throw updSwtErr;

        // Update daily capacity
        const { error: updCapErr } = await supabase
          .rpc('update_daily_capacity_after_scheduling', { p_stage_id: prodStageId, p_date: dateStr, p_additional_minutes: alloc });
        if (updCapErr) throw updCapErr;

        if (!stageStart) stageStart = candidateStart;
        stageEnd = segEnd;
        remaining -= alloc;
        log(`[v2] ${dateStr} stage ${stageId} alloc ${alloc}m, remaining ${remaining}m`);

        // Continue same day if minutes remain and there is still time/capacity
        cursor = new Date(segEnd);
        if (remaining > 0) {
          // Move to next day start
          cursor = nextWorkingDayStart(cursor);
          earliest = cursor;
        }
      }

      if (stageStart && stageEnd) {
        const { error: updStageErr } = await supabase
          .from('job_stage_instances')
          .update({
            scheduled_start_at: stageStart.toISOString(),
            scheduled_end_at: stageEnd.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', stageId);
        if (updStageErr) throw updStageErr;

        scheduled.push({ stage_instance_id: stageId, start: stageStart.toISOString(), end: stageEnd.toISOString(), minutes: estimated });
        dependencyEnd = new Date(stageEnd);
        log(`[v2] stage ${stageId} scheduled ${estimated}m from ${stageStart.toISOString()} to ${stageEnd.toISOString()}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, engine: 'v2', scheduled }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: any) {
    console.error('[schedule-v2] error', e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'unknown' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
