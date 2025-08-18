/**
 * Simple FIFO Production Scheduler - REWRITTEN FOR TRUE SEQUENTIAL SCHEDULING
 * Each stage starts exactly when the previous stage ends - NO GAPS!
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

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

const DEFAULT_CAPACITY = {
  shift_start_hour: 8,
  shift_end_hour: 16,
  shift_end_minute: 30,
  lunch_break_start_hour: 13,
  lunch_break_duration_minutes: 30
};

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function isWorkingDay(supabase: any, date: Date): Promise<boolean> {
  const dayOfWeek = date.getDay();
  
  // Weekend check
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  // Check for public holidays
  const { data: holiday } = await supabase
    .from('public_holidays')
    .select('id')
    .eq('date', formatDate(date))
    .eq('is_active', true)
    .maybeSingle();
  
  return !holiday;
}

async function getNextWorkingDay(supabase: any, startDate: Date): Promise<Date> {
  let currentDate = new Date(startDate);
  
  while (true) {
    if (await isWorkingDay(supabase, currentDate)) {
      return currentDate;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
}

async function getPendingStages(supabase: any): Promise<PendingStage[]> {
  const { data: stages, error } = await supabase
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
    .eq('status', 'pending')
    .not('production_stages.name', 'ilike', '%dtp%')
    .not('production_stages.name', 'ilike', '%proof%')
    .not('production_stages.name', 'ilike', '%batch%allocation%')
    .order('production_jobs.proof_approved_at', { ascending: true });

  if (error) {
    throw error;
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
}

// NEW SIMPLE SEQUENTIAL SCHEDULER - NO MORE COMPLEX SLOT CALCULATIONS!
class SequentialScheduler {
  private currentScheduleTime: Date;
  private supabase: any;
  
  constructor(startDate: Date, supabase: any) {
    // Start scheduling from 8:00 AM on the first working day
    this.currentScheduleTime = new Date(startDate);
    this.currentScheduleTime.setHours(DEFAULT_CAPACITY.shift_start_hour, 0, 0, 0);
    this.supabase = supabase;
  }
  
  async scheduleStage(stage: PendingStage): Promise<{ start: Date; end: Date } | null> {
    // Ensure we're on a working day
    const workingDate = await getNextWorkingDay(this.supabase, this.currentScheduleTime);
    
    // If we moved to a different day, reset to 8:00 AM
    if (formatDate(workingDate) !== formatDate(this.currentScheduleTime)) {
      this.currentScheduleTime = new Date(workingDate);
      this.currentScheduleTime.setHours(DEFAULT_CAPACITY.shift_start_hour, 0, 0, 0);
    }
    
    const startTime = new Date(this.currentScheduleTime);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + stage.estimated_duration_minutes);
    
    // Check if this stage crosses lunch break or end of day
    const lunchStart = new Date(startTime);
    lunchStart.setHours(DEFAULT_CAPACITY.lunch_break_start_hour, 0, 0, 0);
    
    const lunchEnd = new Date(startTime);
    lunchEnd.setHours(DEFAULT_CAPACITY.lunch_break_start_hour, DEFAULT_CAPACITY.lunch_break_duration_minutes, 0, 0);
    
    const dayEnd = new Date(startTime);
    dayEnd.setHours(DEFAULT_CAPACITY.shift_end_hour, DEFAULT_CAPACITY.shift_end_minute, 0, 0);
    
    // If start time is during lunch, move to after lunch
    if (startTime >= lunchStart && startTime < lunchEnd) {
      startTime.setTime(lunchEnd.getTime());
      endTime.setTime(startTime.getTime() + (stage.estimated_duration_minutes * 60 * 1000));
    }
    
    // If end time goes past lunch break, add lunch break duration
    if (startTime < lunchStart && endTime > lunchStart) {
      endTime.setMinutes(endTime.getMinutes() + DEFAULT_CAPACITY.lunch_break_duration_minutes);
    }
    
    // If end time goes past day end, move to next working day
    if (endTime > dayEnd) {
      const nextDay = await getNextWorkingDay(this.supabase, new Date(startTime.getTime() + 24 * 60 * 60 * 1000));
      startTime.setTime(nextDay.getTime());
      startTime.setHours(DEFAULT_CAPACITY.shift_start_hour, 0, 0, 0);
      endTime.setTime(startTime.getTime() + (stage.estimated_duration_minutes * 60 * 1000));
      
      // Check lunch break again for the new day
      const newLunchStart = new Date(startTime);
      newLunchStart.setHours(DEFAULT_CAPACITY.lunch_break_start_hour, 0, 0, 0);
      
      if (startTime < newLunchStart && endTime > newLunchStart) {
        endTime.setMinutes(endTime.getMinutes() + DEFAULT_CAPACITY.lunch_break_duration_minutes);
      }
    }
    
    // Update current schedule time to end of this stage - CRITICAL FOR SEQUENTIAL SCHEDULING!
    this.currentScheduleTime = new Date(endTime);
    
    console.log(`✅ SEQUENTIAL PLACEMENT: ${stage.job_wo_no} (${stage.stage_name}) scheduled from ${startTime.toISOString()} to ${endTime.toISOString()}`);
    
    return { start: startTime, end: endTime };
  }
}

async function processStagesSequentially(supabase: any, stages: PendingStage[]): Promise<void> {
  // Clear all existing scheduled times first
  console.log('🧹 Clearing existing scheduled times...');
  await supabase
    .from('job_stage_instances')
    .update({
      scheduled_start_at: null,
      scheduled_end_at: null,
      scheduled_minutes: null,
      schedule_status: 'unscheduled'
    })
    .eq('status', 'pending');
  
  // Start scheduling from tomorrow at 8:00 AM
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);
  startDate.setHours(0, 0, 0, 0);
  
  const scheduler = new SequentialScheduler(startDate, supabase);
  
  console.log(`🚀 Starting TRUE SEQUENTIAL scheduling for ${stages.length} stages...`);
  
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const schedule = await scheduler.scheduleStage(stage);
    
    if (schedule) {
      // Update the database with scheduled times
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          scheduled_start_at: schedule.start.toISOString(),
          scheduled_end_at: schedule.end.toISOString(),
          scheduled_minutes: stage.estimated_duration_minutes,
          schedule_status: 'scheduled'
        })
        .eq('id', stage.id);
      
      if (error) {
        console.error(`❌ Error updating stage ${stage.id}:`, error);
      } else {
        console.log(`✅ [${i+1}/${stages.length}] Scheduled: ${stage.job_wo_no} - ${stage.stage_name} | ${schedule.start.toLocaleTimeString()} → ${schedule.end.toLocaleTimeString()}`);
      }
    } else {
      console.warn(`⚠️ Could not schedule stage ${stage.stage_name} for job ${stage.job_wo_no}`);
    }
  }
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

    console.log('🔥 REWRITTEN SEQUENTIAL FIFO SCHEDULER STARTING...');
    
    // Get all pending stages sorted by proof approval date (STRICT FIFO ORDER)
    const pendingStages = await getPendingStages(supabase);
    console.log(`📋 Found ${pendingStages.length} pending stages for sequential scheduling`);
    
    if (pendingStages.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending stages to schedule' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Process all stages in TRUE SEQUENTIAL ORDER - NO GAPS!
    await processStagesSequentially(supabase, pendingStages);
    
    console.log(`✅ SEQUENTIAL SCHEDULING COMPLETE! Processed ${pendingStages.length} stages with NO GAPS!`);
    
    return new Response(
      JSON.stringify({ 
        message: `✅ SEQUENTIAL FIFO scheduling completed! Processed ${pendingStages.length} stages with true sequential placement (no gaps)`,
        scheduled_stages: pendingStages.length,
        scheduling_method: 'TRUE_SEQUENTIAL_FIFO'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('❌ Error in sequential scheduler:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});