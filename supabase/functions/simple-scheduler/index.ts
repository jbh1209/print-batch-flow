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

function groupStagesByType(stages: PendingStage[]): { [stageType: string]: PendingStage[] } {
  const groups: { [stageType: string]: PendingStage[] } = {};
  
  stages.forEach(stage => {
    const stageType = stage.stage_name;
    if (!groups[stageType]) {
      groups[stageType] = [];
    }
    groups[stageType].push(stage);
  });
  
  // Sort each group by proof_approved_at for FIFO within stage type
  Object.keys(groups).forEach(stageType => {
    groups[stageType].sort((a, b) => 
      a.proof_approved_at.getTime() - b.proof_approved_at.getTime()
    );
  });
  
  return groups;
}

function isCurrentlyInWorkingHours(): boolean {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const dayOfWeek = now.getDay();
  
  // Weekend check
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  // Check if within working hours (8:00 - 16:30)
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  const startTimeInMinutes = DEFAULT_CAPACITY.shift_start_hour * 60; // 8:00
  const endTimeInMinutes = DEFAULT_CAPACITY.shift_end_hour * 60 + DEFAULT_CAPACITY.shift_end_minute; // 16:30
  
  return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
}

// NEW SIMPLE SEQUENTIAL SCHEDULER - START FROM NOW!
class SequentialScheduler {
  private currentScheduleTime: Date;
  private supabase: any;
  
  constructor(startDate: Date, supabase: any) {
    this.currentScheduleTime = new Date(startDate);
    this.supabase = supabase;
    
    // If the start date is today and we're in working hours, start from NOW
    const now = new Date();
    const isToday = formatDate(this.currentScheduleTime) === formatDate(now);
    
    if (isToday && isCurrentlyInWorkingHours()) {
      // Start from current time, rounded up to next 5-minute interval
      this.currentScheduleTime = new Date(now);
      const minutes = this.currentScheduleTime.getMinutes();
      const roundedMinutes = Math.ceil(minutes / 5) * 5;
      this.currentScheduleTime.setMinutes(roundedMinutes, 0, 0);
      console.log(`🕐 Starting from NOW (${this.currentScheduleTime.toLocaleTimeString()}) - we're in working hours!`);
    } else {
      // Start from 8:00 AM on the specified day
      this.currentScheduleTime.setHours(DEFAULT_CAPACITY.shift_start_hour, 0, 0, 0);
      console.log(`🕐 Starting from ${this.currentScheduleTime.toLocaleTimeString()} on ${formatDate(this.currentScheduleTime)}`);
    }
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
  
  // Determine start date: NOW if in working hours, else next working day
  const now = new Date();
  let startDate: Date;
  
  if (isCurrentlyInWorkingHours()) {
    startDate = new Date(now);
    console.log(`🕐 We're in working hours! Starting from NOW: ${startDate.toLocaleTimeString()}`);
  } else {
    startDate = await getNextWorkingDay(supabase, now);
    startDate.setHours(DEFAULT_CAPACITY.shift_start_hour, 0, 0, 0);
    console.log(`🕐 Outside working hours. Starting from next working day: ${startDate.toLocaleString()}`);
  }
  
  // Group stages by type for sequential processing
  const stageGroups = groupStagesByType(stages);
  const stageTypes = Object.keys(stageGroups);
  
  console.log(`📊 STAGE GROUPS FOUND: ${stageTypes.join(', ')}`);
  stageTypes.forEach(stageType => {
    console.log(`   ${stageType}: ${stageGroups[stageType].length} stages`);
  });
  
  const scheduler = new SequentialScheduler(startDate, supabase);
  let totalScheduled = 0;
  
  // Process each stage type sequentially
  for (const stageType of stageTypes) {
    const stagesOfType = stageGroups[stageType];
    console.log(`\n🎯 SCHEDULING ALL ${stageType.toUpperCase()} STAGES (${stagesOfType.length} stages)...`);
    
    for (let i = 0; i < stagesOfType.length; i++) {
      const stage = stagesOfType[i];
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
          totalScheduled++;
          console.log(`✅ [${totalScheduled}/${stages.length}] ${stageType}: ${stage.job_wo_no} | ${schedule.start.toLocaleTimeString()} → ${schedule.end.toLocaleTimeString()}`);
        }
      } else {
        console.warn(`⚠️ Could not schedule stage ${stage.stage_name} for job ${stage.job_wo_no}`);
      }
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

    console.log('🔥 START-FROM-NOW SEQUENTIAL FIFO SCHEDULER STARTING...');
    
    // Get all pending stages sorted by proof approval date (STRICT FIFO ORDER)
    const pendingStages = await getPendingStages(supabase);
    console.log(`📋 Found ${pendingStages.length} pending stages for sequential scheduling`);
    
    if (pendingStages.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending stages to schedule' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const inWorkingHours = isCurrentlyInWorkingHours();
    console.log(`⏰ Current time check: ${inWorkingHours ? 'IN WORKING HOURS' : 'OUTSIDE WORKING HOURS'}`);
    
    // Process all stages by stage type in TRUE SEQUENTIAL ORDER - NO GAPS!
    await processStagesSequentially(supabase, pendingStages);
    
    console.log(`✅ STAGE-TYPE SEQUENTIAL SCHEDULING COMPLETE! Processed ${pendingStages.length} stages with NO GAPS!`);
    
    return new Response(
      JSON.stringify({ 
        message: `✅ START-FROM-NOW SEQUENTIAL scheduling completed! Processed ${pendingStages.length} stages by stage type with true sequential placement`,
        scheduled_stages: pendingStages.length,
        scheduling_method: 'START_FROM_NOW_STAGE_TYPE_SEQUENTIAL',
        started_from_current_time: inWorkingHours
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