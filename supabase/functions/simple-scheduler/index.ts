/**
 * Sequential production scheduler - Simple FIFO implementation with NO GAPS
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { zonedTimeToUtc, utcToZonedTime } from 'https://esm.sh/date-fns-tz@2.0.1';
import { corsHeaders } from '../_shared/cors.ts';

// ---- SAST timezone helpers ----
const SAST_TZ = 'Africa/Johannesburg';
const BUSINESS_START = { hh: 8, mm: 0 };
const BUSINESS_END = { hh: 17, mm: 30 };

function sastWallClockToUtc(yyyyMmDd: string, hh: number, mm: number): Date {
  const s = `${yyyyMmDd}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`;
  return zonedTimeToUtc(s, SAST_TZ);
}

function getBusinessWindowUtcForDay(dUtc: Date): { startUtc: Date; endUtc: Date } {
  const sast = utcToZonedTime(dUtc, SAST_TZ);
  const yyyyMmDd = `${sast.getFullYear()}-${String(sast.getMonth()+1).padStart(2,'0')}-${String(sast.getDate()).padStart(2,'0')}`;
  const startUtc = sastWallClockToUtc(yyyyMmDd, BUSINESS_START.hh, BUSINESS_START.mm);
  const endUtc = sastWallClockToUtc(yyyyMmDd, BUSINESS_END.hh, BUSINESS_END.mm);
  return { startUtc, endUtc };
}

function clampToBusinessWindowUtc(cursorUtc: Date): Date {
  const { startUtc, endUtc } = getBusinessWindowUtcForDay(cursorUtc);
  if (cursorUtc < startUtc) return startUtc;
  if (cursorUtc >= endUtc) {
    // jump to next day start (SAST)
    const nextDaySast = utcToZonedTime(new Date(endUtc.getTime() + 24*60*60*1000), SAST_TZ);
    const yyyyMmDd = `${nextDaySast.getFullYear()}-${String(nextDaySast.getMonth()+1).padStart(2,'0')}-${String(nextDaySast.getDate()).padStart(2,'0')}`;
    return sastWallClockToUtc(yyyyMmDd, BUSINESS_START.hh, BUSINESS_START.mm);
  }
  return cursorUtc;
}

interface PendingStage {
  id: string;
  job_id: string;
  job_table_name: string;
  production_stage_id: string;
  stage_name: string;
  job_wo_no: string;
  stage_order: number;
  estimated_duration_minutes: number;
  proof_approved_at: Date;
  category_id: string;
}

async function getPendingStages(supabase: any): Promise<PendingStage[]> {
  console.log('🔍 Fetching ONLY approved and ready stages...');
  
  try {
    // Use the new view to get jobs ready for production
    const { data: approvedJobs, error: jobError } = await supabase
      .from('v_jobs_ready_for_production')
      .select('id, wo_no, proof_approved_at, status, created_at')
      .eq('is_ready_for_production', true)
      .in('status', ['pending', 'active'])
      .order('proof_approved_at', { ascending: true })
      .order('created_at', { ascending: true });

    if (jobError) {
      console.error('❌ Error fetching approved jobs:', jobError);
      throw jobError;
    }

    console.log(`✅ Found ${approvedJobs?.length || 0} approved jobs`);
    if (!approvedJobs?.length) {
      console.log('⚠️ No approved jobs found - nothing to schedule');
      return [];
    }

    const jobIds = approvedJobs.map(job => job.id);

    // Get stages for these jobs
    const { data: stages, error: stageError } = await supabase
      .from('job_stage_instances')
      .select(`
        id,
        job_id,
        job_table_name,
        production_stage_id,
        stage_order,
        estimated_duration_minutes,
        category_id,
        production_stages!inner(name),
        production_jobs!inner(wo_no, proof_approved_at)
      `)
      .in('job_id', jobIds)
      .in('status', ['pending', 'active', 'scheduled'])
      .not('production_stages.name', 'ilike', '%dtp%')
      .not('production_stages.name', 'ilike', '%proof%')
      .not('production_stages.name', 'ilike', '%batch%allocation%')
      .order('production_jobs.proof_approved_at', { ascending: true });

    if (stageError) {
      console.error('❌ Error fetching stages:', stageError);
      throw stageError;
    }

    return (stages || []).map(stage => ({
      id: stage.id,
      job_id: stage.job_id,
      job_table_name: stage.job_table_name,
      production_stage_id: stage.production_stage_id,
      stage_name: (stage.production_stages as any)?.name || 'Unknown Stage',
      job_wo_no: (stage.production_jobs as any)?.wo_no || 'Unknown',
      stage_order: stage.stage_order,
      estimated_duration_minutes: stage.estimated_duration_minutes || 60,
      proof_approved_at: new Date((stage.production_jobs as any)?.proof_approved_at || new Date()),
      category_id: stage.category_id
    }));
    
  } catch (error) {
    console.error('❌ Critical error in getPendingStages:', error);
    throw error;
  }
}

// Sequential Scheduler with proper UTC time handling
class SequentialScheduler {
  scheduleStartTime: Date;
  cursor: Date;
  supabase: any;

  constructor(startTimeUtc: Date, supabase: any) {
    this.scheduleStartTime = startTimeUtc;
    this.cursor = startTimeUtc;
    this.supabase = supabase;
  }

  async findEarliestSlotUtc(
    stageId: string,
    durationMin: number,
    dayStartUtc: Date,
    dayEndUtc: Date
  ): Promise<{ startUtc: Date; endUtc: Date } | null> {
    const { data, error } = await this.supabase
      .from('job_stage_instances')
      .select('scheduled_start_at, scheduled_end_at')
      .eq('production_stage_id', stageId)
      .gte('scheduled_start_at', dayStartUtc.toISOString())
      .lt('scheduled_start_at', dayEndUtc.toISOString());

    if (error) throw error;

    const existing = (data || []).map((r: any) => ({
      startUtc: new Date(r.scheduled_start_at),
      endUtc: new Date(r.scheduled_end_at),
    })).sort((a,b) => a.startUtc.getTime() - b.startUtc.getTime());

    // Build gaps
    const free: Array<{ s: Date; e: Date }> = [];
    let cursor = dayStartUtc;
    for (const b of existing) {
      if (b.startUtc > cursor) free.push({ s: cursor, e: b.startUtc });
      if (b.endUtc > cursor) cursor = b.endUtc;
    }
    if (cursor < dayEndUtc) free.push({ s: cursor, e: dayEndUtc });

    for (const gap of free) {
      const gapMin = (gap.e.getTime() - gap.s.getTime()) / 60000;
      if (gapMin >= durationMin) {
        const startUtc = gap.s;
        const endUtc = new Date(startUtc.getTime() + durationMin * 60000);
        return { startUtc, endUtc };
      }
    }

    return null;
  }

  async scheduleStage(stage: PendingStage, userId?: string): Promise<boolean> {
    const durationMinutes = stage.estimated_duration_minutes || 60;
    
    console.log(`📋 Scheduling: ${stage.job_wo_no} (${stage.stage_name}) - ${durationMinutes} minutes`);
    
    // Find available time slot within working hours
    let attempts = 0;
    const maxAttempts = 30; // Prevent infinite loops
    
    while (attempts < maxAttempts) {
      attempts++;
      
      const { startUtc: dayStartUtc, endUtc: dayEndUtc } = getBusinessWindowUtcForDay(this.cursor);
      
      const slot = await this.findEarliestSlotUtc(stage.production_stage_id, durationMinutes, dayStartUtc, dayEndUtc);
      
      if (slot) {
        // Schedule the stage
        const { error: updateError } = await this.supabase
          .from('job_stage_instances')
          .update({
            scheduled_start_at: slot.startUtc.toISOString(),
            scheduled_end_at: slot.endUtc.toISOString(),
            scheduled_minutes: durationMinutes,
            schedule_status: 'scheduled',
            scheduling_method: 'auto',
            scheduled_by_user_id: userId || null
          })
          .eq('id', stage.id);
        
        if (updateError) {
          console.error(`❌ Error updating stage ${stage.id}:`, updateError);
          return false;
        }
        
        const timeStr = slot.startUtc.toISOString().substring(11, 16);
        const endStr = slot.endUtc.toISOString().substring(11, 16);
        console.log(`✅ SEQUENTIAL PLACEMENT: ${stage.job_wo_no} (${stage.stage_name}) scheduled from ${slot.startUtc.toISOString()} to ${slot.endUtc.toISOString()}`);
        
        // Move cursor to end of this booking for consecutive stages
        this.cursor = slot.endUtc;
        return true;
      } else {
        // Move to next business day
        this.cursor = clampToBusinessWindowUtc(new Date(dayEndUtc.getTime() + 1000));
      }
    }
    
    console.error(`❌ Failed to schedule stage after ${maxAttempts} attempts: ${stage.job_wo_no} (${stage.stage_name})`);
    return false;
  }
}

/**
 * Process stages sequentially with pure FIFO order
 */
async function processStagesSequentially(stages: PendingStage[], supabase: any, userId?: string): Promise<number> {
  console.log(`🎯 PROCESSING ${stages.length} STAGES IN PURE FIFO ORDER...`);
  
  // NUCLEAR RESET: Clear all scheduled times first
  console.log('💥 NUCLEAR RESET: Clearing all existing schedules...');
  const { error: resetError } = await supabase
    .from('job_stage_instances')
    .update({
      scheduled_start_at: null,
      scheduled_end_at: null,
      scheduled_minutes: null,
      schedule_status: 'unscheduled'
    })
    .in('status', ['pending', 'active', 'scheduled']);
    
  if (resetError) {
    console.error('❌ Error during nuclear reset:', resetError);
    throw resetError;
  }
  
  // Start scheduling from now, clamped to business window
  const scheduleStartUtc = clampToBusinessWindowUtc(new Date());
  console.log(`🎯 Starting schedule from: ${scheduleStartUtc.toISOString()}`);
  
  const scheduler = new SequentialScheduler(scheduleStartUtc, supabase);
  
  let totalScheduled = 0;
  
  // Pure FIFO processing - no grouping by stage type
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const success = await scheduler.scheduleStage(stage, userId);
    
    if (success) {
      totalScheduled++;
      console.log(`✅ [${totalScheduled}/${stages.length}] ${stage.job_wo_no} (${stage.stage_name}) scheduled`);
    } else {
      console.error(`❌ Failed to schedule: ${stage.job_wo_no} (${stage.stage_name})`);
    }
  }
  
  console.log(`✅ FIFO RESCHEDULE COMPLETE! Scheduled ${totalScheduled} stages in pure FIFO order!`);
  return totalScheduled;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔥 PURE FIFO SCHEDULER STARTING...');
    
    // Get all pending stages sorted by proof approval date (STRICT FIFO ORDER)
    const pendingStages = await getPendingStages(supabase);
    console.log(`📋 Found ${pendingStages.length} pending stages for sequential scheduling`);
    
    if (pendingStages.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No pending stages to schedule',
          scheduled_count: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Process all stages in PURE FIFO order
    const scheduledCount = await processStagesSequentially(pendingStages, supabase);
    
    console.log(`✅ PURE FIFO RESCHEDULE COMPLETE! Scheduled ${scheduledCount} stages!`);
    
    return new Response(
      JSON.stringify({ 
        message: `✅ Pure FIFO reschedule completed! Scheduled ${scheduledCount} stages`,
        scheduled_count: scheduledCount,
        scheduling_method: 'PURE_FIFO',
        total_stages_found: pendingStages.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('❌ Error in scheduler:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});