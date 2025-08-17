/**
 * Simple FIFO Production Scheduler
 * Triggered when jobs are approved and need scheduling
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

interface WorkingDay {
  date: string;
  total_capacity_minutes: number;
  used_minutes: number;
  remaining_minutes: number;
}

interface TimeSlot {
  start: Date;
  end: Date;
  duration_minutes: number;
}

const DEFAULT_CAPACITY = {
  daily_capacity_minutes: 450, // 8:00-16:30 with 30min lunch
  shift_start_hour: 8,
  shift_end_hour: 16,
  shift_end_minute: 30,
  lunch_break_start_hour: 13,
  lunch_break_duration_minutes: 30
};

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function calculateDayTimeSlots(date: Date): TimeSlot[] {
  const slots: TimeSlot[] = [];
  
  // Morning slot: 8:00-13:00 (5 hours = 300 minutes)
  const morningStart = new Date(date);
  morningStart.setHours(DEFAULT_CAPACITY.shift_start_hour, 0, 0, 0);
  const morningEnd = new Date(date);
  morningEnd.setHours(DEFAULT_CAPACITY.lunch_break_start_hour, 0, 0, 0);
  
  slots.push({
    start: morningStart,
    end: morningEnd,
    duration_minutes: 300
  });
  
  // Afternoon slot: 13:30-16:30 (3 hours = 180 minutes) 
  const afternoonStart = new Date(date);
  afternoonStart.setHours(DEFAULT_CAPACITY.lunch_break_start_hour, DEFAULT_CAPACITY.lunch_break_duration_minutes, 0, 0);
  const afternoonEnd = new Date(date);
  afternoonEnd.setHours(DEFAULT_CAPACITY.shift_end_hour, DEFAULT_CAPACITY.shift_end_minute, 0, 0);
  
  slots.push({
    start: afternoonStart,
    end: afternoonEnd,
    duration_minutes: 150
  });
  
  return slots;
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

async function generateWorkingDays(supabase: any, startDate: Date, daysToGenerate: number = 30): Promise<WorkingDay[]> {
  const workingDays: WorkingDay[] = [];
  let currentDate = await getNextWorkingDay(supabase, startDate);
  
  for (let i = 0; i < daysToGenerate; i++) {
    const timeSlots = calculateDayTimeSlots(currentDate);
    const totalCapacity = timeSlots.reduce((sum, slot) => sum + slot.duration_minutes, 0);
    
    workingDays.push({
      date: formatDate(currentDate),
      total_capacity_minutes: totalCapacity,
      used_minutes: 0,
      remaining_minutes: totalCapacity
    });
    
    // Move to next working day
    currentDate.setDate(currentDate.getDate() + 1);
    currentDate = await getNextWorkingDay(supabase, currentDate);
  }
  
  return workingDays;
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

function scheduleStage(stage: PendingStage, workingDays: WorkingDay[]): { start: Date; end: Date } | null {
  for (const day of workingDays) {
    if (day.remaining_minutes >= stage.estimated_duration_minutes) {
      // Can fit entirely in this day
      const dayDate = new Date(day.date);
      const timeSlots = calculateDayTimeSlots(dayDate);
      
      // Calculate start time based on used minutes
      let accumulatedTime = 0;
      for (const slot of timeSlots) {
        const slotStartTime = accumulatedTime;
        const slotEndTime = accumulatedTime + slot.duration_minutes;
        
        if (day.used_minutes >= slotStartTime && day.used_minutes < slotEndTime) {
          // This slot is where we need to start
          const minutesIntoSlot = day.used_minutes - slotStartTime;
          const remainingInSlot = slot.duration_minutes - minutesIntoSlot;
          
          if (remainingInSlot >= stage.estimated_duration_minutes) {
            // Can fit in this slot
            const startTime = new Date(slot.start);
            startTime.setMinutes(startTime.getMinutes() + minutesIntoSlot);
            
            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + stage.estimated_duration_minutes);
            
            // Update day capacity
            day.used_minutes += stage.estimated_duration_minutes;
            day.remaining_minutes -= stage.estimated_duration_minutes;
            
            return { start: startTime, end: endTime };
          }
        }
        
        accumulatedTime += slot.duration_minutes;
      }
    }
  }
  
  return null; // Could not schedule
}

async function processStages(supabase: any, stages: PendingStage[], workingDays: WorkingDay[]): Promise<void> {
  for (const stage of stages) {
    const schedule = scheduleStage(stage, workingDays);
    
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
        console.error(`Error updating stage ${stage.id}:`, error);
      } else {
        console.log(`Scheduled stage ${stage.stage_name} for job ${stage.job_wo_no}: ${schedule.start.toISOString()} - ${schedule.end.toISOString()}`);
      }
    } else {
      console.warn(`Could not schedule stage ${stage.stage_name} for job ${stage.job_wo_no} - insufficient capacity`);
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

    console.log('Starting FIFO scheduler...');
    
    // Get all pending stages sorted by proof approval date
    const pendingStages = await getPendingStages(supabase);
    console.log(`Found ${pendingStages.length} pending stages`);
    
    if (pendingStages.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending stages to schedule' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Generate working days starting from tomorrow
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(0, 0, 0, 0);
    
    const workingDays = await generateWorkingDays(supabase, startDate, 30);
    console.log(`Generated ${workingDays.length} working days`);
    
    // Process all stages in FIFO order
    await processStages(supabase, pendingStages, workingDays);
    
    return new Response(
      JSON.stringify({ 
        message: `Processed ${pendingStages.length} stages across ${workingDays.length} working days`,
        scheduled_stages: pendingStages.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in simple-scheduler:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});