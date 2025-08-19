/**
 * Sequential production scheduler - Pure UTC FIFO implementation
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts';

// Business hours in UTC (8:00-16:30 with 13:00-13:30 lunch break)
const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 16;
const BUSINESS_END_MINUTE = 30;
const LUNCH_START_HOUR = 13;
const LUNCH_END_HOUR = 13;
const LUNCH_END_MINUTE = 30;

function getBusinessWindowUtc(date: Date): { startUtc: Date; endUtc: Date; lunchStartUtc: Date; lunchEndUtc: Date } {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  
  const startUtc = new Date(Date.UTC(year, month, day, BUSINESS_START_HOUR, 0, 0));
  const endUtc = new Date(Date.UTC(year, month, day, BUSINESS_END_HOUR, BUSINESS_END_MINUTE, 0));
  const lunchStartUtc = new Date(Date.UTC(year, month, day, LUNCH_START_HOUR, 0, 0));
  const lunchEndUtc = new Date(Date.UTC(year, month, day, LUNCH_END_HOUR, LUNCH_END_MINUTE, 0));
  
  return { startUtc, endUtc, lunchStartUtc, lunchEndUtc };
}

function getNextWorkingDay(date: Date): Date {
  const nextDay = new Date(date);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  
  // Skip weekends
  while (nextDay.getUTCDay() === 0 || nextDay.getUTCDay() === 6) {
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  }
  
  return nextDay;
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
  console.log('🔍 Fetching pending stages for scheduling...');
  
  try {
    // Get all job stage instances that are NOT completed and ready for scheduling
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
        status,
        production_stages!inner(name),
        production_jobs!inner(wo_no, proof_approved_at, status)
      `)
      .in('status', ['pending', 'active'])
      .neq('production_jobs.status', 'Completed')
      .not('production_stages.name', 'ilike', '%dtp%')
      .not('production_stages.name', 'ilike', '%proof%')
      .not('production_stages.name', 'ilike', '%batch%allocation%')
      .not('production_jobs.proof_approved_at', 'is', null)
      .order('production_jobs.proof_approved_at', { ascending: true })
      .order('stage_order', { ascending: true });

    if (stageError) {
      console.error('❌ Error fetching stages:', stageError);
      throw stageError;
    }

    console.log(`✅ Found ${stages?.length || 0} pending stages`);

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

  findNextAvailableSlot(
    durationMin: number,
    startFromUtc: Date
  ): { startUtc: Date; endUtc: Date } {
    const { startUtc: dayStartUtc, endUtc: dayEndUtc, lunchStartUtc, lunchEndUtc } = getBusinessWindowUtc(startFromUtc);
    
    // If we're before business hours, start at business hours
    if (startFromUtc < dayStartUtc) {
      startFromUtc = dayStartUtc;
    }
    
    // If we're after business hours, move to next working day
    if (startFromUtc >= dayEndUtc) {
      const nextDay = getNextWorkingDay(startFromUtc);
      const { startUtc: nextDayStart } = getBusinessWindowUtc(nextDay);
      return this.findNextAvailableSlot(durationMin, nextDayStart);
    }
    
    // Check if slot fits before lunch
    const morningEndUtc = lunchStartUtc;
    const availableBeforeLunch = (morningEndUtc.getTime() - startFromUtc.getTime()) / 60000;
    
    if (availableBeforeLunch >= durationMin) {
      // Fits before lunch
      const endUtc = new Date(startFromUtc.getTime() + durationMin * 60000);
      return { startUtc: startFromUtc, endUtc };
    }
    
    // Check if slot fits after lunch
    const afternoonStartUtc = lunchEndUtc;
    const availableAfterLunch = (dayEndUtc.getTime() - afternoonStartUtc.getTime()) / 60000;
    
    if (availableAfterLunch >= durationMin) {
      // Fits after lunch
      const startUtc = Math.max(startFromUtc.getTime(), afternoonStartUtc.getTime()) === startFromUtc.getTime() && startFromUtc >= afternoonStartUtc ? startFromUtc : afternoonStartUtc;
      const endUtc = new Date(startUtc.getTime() + durationMin * 60000);
      return { startUtc: new Date(startUtc), endUtc };
    }
    
    // Doesn't fit today, move to next working day
    const nextDay = getNextWorkingDay(startFromUtc);
    const { startUtc: nextDayStart } = getBusinessWindowUtc(nextDay);
    return this.findNextAvailableSlot(durationMin, nextDayStart);
  }

  async scheduleStage(stage: PendingStage, userId?: string): Promise<boolean> {
    const durationMinutes = stage.estimated_duration_minutes || 60;
    
    console.log(`📋 Scheduling: ${stage.job_wo_no} (${stage.stage_name}) - ${durationMinutes} minutes`);
    
    // Find next available slot starting from current cursor
    const slot = this.findNextAvailableSlot(durationMinutes, this.cursor);
    
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
    console.log(`✅ SCHEDULED: ${stage.job_wo_no} (${stage.stage_name}) ${timeStr}-${endStr}`);
    
    // Move cursor to end of this booking for next stage
    this.cursor = slot.endUtc;
    return true;
  }
}

/**
 * Process stages sequentially with pure FIFO order
 */
async function processStagesSequentially(stages: PendingStage[], supabase: any, userId?: string): Promise<number> {
  console.log(`🎯 PROCESSING ${stages.length} STAGES IN PURE FIFO ORDER...`);
  
  // COMPLETE NUCLEAR RESET: Clear ALL scheduled data regardless of status
  console.log('💥 COMPLETE NUCLEAR RESET: Clearing ALL existing schedule data...');
  const { error: resetError } = await supabase
    .from('job_stage_instances')
    .update({
      scheduled_start_at: null,
      scheduled_end_at: null,
      scheduled_minutes: null,
      schedule_status: 'unscheduled',
      scheduled_by_user_id: null,
      scheduling_method: null
    })
    .not('id', 'is', null); // Clear for ALL records
    
  if (resetError) {
    console.error('❌ Error during complete nuclear reset:', resetError);
    throw resetError;
  }
  
  // Start scheduling from tomorrow at 8:00 AM UTC
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(BUSINESS_START_HOUR, 0, 0, 0);
  
  // Skip weekends
  while (tomorrow.getUTCDay() === 0 || tomorrow.getUTCDay() === 6) {
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  }
  
  console.log(`🎯 Starting schedule from tomorrow: ${tomorrow.toISOString()}`);
  
  const scheduler = new SequentialScheduler(tomorrow, supabase);
  
  let totalScheduled = 0;
  
  // Pure FIFO processing - schedule each stage sequentially
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
  
  console.log(`✅ FIFO RESCHEDULE COMPLETE! Scheduled ${totalScheduled} stages starting tomorrow!`);
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

    console.log('🔥 PURE UTC FIFO SCHEDULER STARTING...');
    
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
    
    console.log(`✅ PURE UTC FIFO RESCHEDULE COMPLETE! Scheduled ${scheduledCount} stages starting tomorrow!`);
    
    return new Response(
      JSON.stringify({ 
        message: `✅ Pure UTC FIFO reschedule completed! Scheduled ${scheduledCount} stages starting tomorrow`,
        scheduled_count: scheduledCount,
        scheduling_method: 'PURE_UTC_FIFO',
        total_stages_found: pendingStages.length,
        start_date: 'tomorrow_8am_utc'
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