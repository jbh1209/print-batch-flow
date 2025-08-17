/**
 * Simple Sequential Job Stage Scheduler
 * Places job stages into working days sequentially (FIFO) until capacity is full
 */

import { supabase } from "@/integrations/supabase/client";

export interface ScheduledStage {
  id: string;
  job_id: string;
  job_wo_no: string;
  stage_name: string;
  stage_order: number;
  estimated_duration_minutes: number;
  scheduled_start_at: Date;
  scheduled_end_at: Date;
  scheduled_date: string; // YYYY-MM-DD format
}

export interface WorkingDayContainer {
  date: string; // YYYY-MM-DD format
  used_minutes: number;
  remaining_minutes: number;
  scheduled_stages: ScheduledStage[];
}

const DAILY_CAPACITY_MINUTES = 480; // 8 hours
const SHIFT_START_HOUR = 8; // 08:00

/**
 * Check if a date is a working day (Mon-Fri, not public holiday)
 */
async function isWorkingDay(date: Date): Promise<boolean> {
  const dayOfWeek = date.getDay();
  
  // Skip weekends (Sunday = 0, Saturday = 6)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  // Check if it's a public holiday
  const dateStr = date.toISOString().split('T')[0];
  const { data: holidays } = await supabase
    .from('public_holidays')
    .select('date')
    .eq('date', dateStr)
    .eq('is_active', true);
  
  return !holidays || holidays.length === 0;
}

/**
 * Get the next working day from a given date
 */
async function getNextWorkingDay(startDate: Date): Promise<Date> {
  let currentDate = new Date(startDate);
  
  while (true) {
    if (await isWorkingDay(currentDate)) {
      return currentDate;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
}

/**
 * Get all pending job stage instances ordered by job creation date (FIFO)
 */
async function getPendingStages() {
  // First get job stage instances with production stage names
  const { data: stageData, error: stageError } = await supabase
    .from('job_stage_instances')
    .select(`
      id,
      job_id,
      production_stage_id,
      stage_order,
      estimated_duration_minutes,
      created_at,
      job_table_name,
      production_stages!inner(name)
    `)
    .eq('status', 'pending')
    .eq('job_table_name', 'production_jobs');

  if (stageError) {
    console.error('Error fetching pending stages:', stageError);
    return [];
  }

  if (!stageData || stageData.length === 0) {
    return [];
  }

  // Get unique job IDs
  const jobIds = [...new Set(stageData.map(stage => stage.job_id))];

  // Get job details separately
  const { data: jobData, error: jobError } = await supabase
    .from('production_jobs')
    .select('id, wo_no, created_at')
    .in('id', jobIds);

  if (jobError) {
    console.error('Error fetching job data:', jobError);
    return [];
  }

  // Create job lookup map
  const jobMap = new Map(jobData?.map(job => [job.id, job]) || []);

  // Combine data and sort by job creation date, then stage order
  const combinedData = stageData
    .map(stage => {
      const job = jobMap.get(stage.job_id);
      return {
        id: stage.id,
        job_id: stage.job_id,
        job_wo_no: job?.wo_no || 'Unknown',
        stage_name: stage.production_stages.name,
        stage_order: stage.stage_order,
        estimated_duration_minutes: stage.estimated_duration_minutes || 60,
        job_created_at: job?.created_at || new Date().toISOString()
      };
    })
    .sort((a, b) => {
      // First sort by job creation date
      const dateCompare = new Date(a.job_created_at).getTime() - new Date(b.job_created_at).getTime();
      if (dateCompare !== 0) return dateCompare;
      // Then by stage order
      return a.stage_order - b.stage_order;
    });

  return combinedData;
}

/**
 * Calculate scheduled times for all pending stages
 */
export async function calculateSequentialSchedule(): Promise<WorkingDayContainer[]> {
  const pendingStages = await getPendingStages();
  const workingDays: Map<string, WorkingDayContainer> = new Map();
  
  if (pendingStages.length === 0) {
    return [];
  }

  let currentDate = new Date();
  currentDate = await getNextWorkingDay(currentDate);

  for (const stage of pendingStages) {
    let placed = false;
    
    while (!placed) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Get or create working day container
      if (!workingDays.has(dateStr)) {
        workingDays.set(dateStr, {
          date: dateStr,
          used_minutes: 0,
          remaining_minutes: DAILY_CAPACITY_MINUTES,
          scheduled_stages: []
        });
      }
      
      const workingDay = workingDays.get(dateStr)!;
      
      // Check if stage fits in current day
      if (stage.estimated_duration_minutes <= workingDay.remaining_minutes) {
        // Calculate start and end times
        const startTime = new Date(currentDate);
        startTime.setHours(SHIFT_START_HOUR, workingDay.used_minutes, 0, 0);
        
        const endTime = new Date(startTime);
        endTime.setMinutes(startTime.getMinutes() + stage.estimated_duration_minutes);
        
        // Create scheduled stage
        const scheduledStage: ScheduledStage = {
          id: stage.id,
          job_id: stage.job_id,
          job_wo_no: stage.job_wo_no,
          stage_name: stage.stage_name,
          stage_order: stage.stage_order,
          estimated_duration_minutes: stage.estimated_duration_minutes,
          scheduled_start_at: startTime,
          scheduled_end_at: endTime,
          scheduled_date: dateStr
        };
        
        // Add to working day
        workingDay.scheduled_stages.push(scheduledStage);
        workingDay.used_minutes += stage.estimated_duration_minutes;
        workingDay.remaining_minutes -= stage.estimated_duration_minutes;
        
        placed = true;
      } else {
        // Move to next working day
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate = await getNextWorkingDay(currentDate);
      }
    }
  }
  
  return Array.from(workingDays.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Update database with scheduled times
 */
export async function updateScheduledTimes(scheduledStages: ScheduledStage[]): Promise<boolean> {
  try {
    // Update each stage individually to avoid constraint issues
    for (const stage of scheduledStages) {
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          scheduled_start_at: stage.scheduled_start_at.toISOString(),
          scheduled_end_at: stage.scheduled_end_at.toISOString(),
          schedule_status: 'scheduled'
        })
        .eq('id', stage.id);

      if (error) {
        console.error('Error updating stage:', stage.id, error);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error in updateScheduledTimes:', error);
    return false;
  }
}