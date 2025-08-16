/**
 * **PHASE 2: PARALLEL CAPACITY SCHEDULER**
 * Fixes the "10 days later" scheduling bug by implementing daily capacity logic
 * Replaces sequential queue with parallel job capacity per day
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentSAST, toSAST, formatSAST } from '../timezone';
import { addDays, isWeekend } from 'date-fns';

export interface StageCapacity {
  stageId: string;
  dailyCapacityMinutes: number;
  maxParallelJobs: number;
  workingStartHour: number; // 8 AM SAST
  workingEndHour: number;   // 17.5 (5:30 PM SAST) 
}

export interface JobScheduleRequest {
  jobId: string;
  stageId: string;
  estimatedMinutes: number;
  earliestStart?: Date;
  priority?: number; // Lower = higher priority
}

export interface ScheduledSlot {
  jobId: string;
  stageId: string;
  scheduledStart: Date; // SAST
  scheduledEnd: Date;   // SAST
  estimatedMinutes: number;
  capacityDate: string; // yyyy-MM-dd in SAST
}

export interface CapacityResult {
  success: boolean;
  scheduledSlots: ScheduledSlot[];
  errors: string[];
  capacityAnalysis: {
    stageId: string;
    date: string;
    usedMinutes: number;
    availableMinutes: number;
    totalCapacity: number;
  }[];
}

/**
 * **PARALLEL CAPACITY SCHEDULER CLASS**
 * Fixes "10 days later" bug by packing jobs within daily capacity
 */
export class ParallelCapacityScheduler {
  private stageCapacities: Map<string, StageCapacity>;

  constructor(stageCapacities: StageCapacity[]) {
    this.stageCapacities = new Map(
      stageCapacities.map(stage => [stage.stageId, stage])
    );
  }

  /**
   * **CORE FIX: Find next available capacity slot (not queue end time)**
   * This replaces the broken get_stage_queue_end_time() function
   */
  async findNextAvailableSlot(
    stageId: string, 
    requiredMinutes: number,
    earliestStart: Date = getCurrentSAST()
  ): Promise<{ start: Date; end: Date; date: string } | null> {
    
    const stageCapacity = this.stageCapacities.get(stageId);
    if (!stageCapacity) {
      console.warn(`No capacity profile found for stage ${stageId}, using defaults`);
      // Use database function as fallback
      return this.findSlotUsingDatabase(stageId, requiredMinutes, earliestStart);
    }

    let currentDay = this.getNextWorkingDay(earliestStart);
    
    // Try each day until we find capacity (max 90 days)
    for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
      const dayToCheck = addDays(currentDay, dayOffset);
      
      if (isWeekend(dayToCheck)) continue;

      const availableSlot = await this.findSlotInDay(
        stageId, 
        dayToCheck, 
        requiredMinutes,
        stageCapacity
      );

      if (availableSlot) {
        return availableSlot;
      }
    }

    return null; // No capacity found in 90 days
  }

  /**
   * **CAPACITY PACKING LOGIC: Core fix for daily scheduling**
   * Checks if day has enough free minutes, packs jobs within same day
   */
  private async findSlotInDay(
    stageId: string, 
    date: Date, 
    requiredMinutes: number,
    capacity: StageCapacity
  ): Promise<{ start: Date; end: Date; date: string } | null> {
    
    const dateStr = formatSAST(date, 'yyyy-MM-dd');
    
    // Get jobs already scheduled for this stage on this date
    const usedMinutes = await this.getUsedCapacityForDate(stageId, dateStr);
    const availableMinutes = capacity.dailyCapacityMinutes - usedMinutes;
    
    console.log(`[CAPACITY CHECK] Stage ${stageId} on ${dateStr}: ${usedMinutes}/${capacity.dailyCapacityMinutes} minutes used (${availableMinutes} available)`);
    
    if (availableMinutes < requiredMinutes) {
      return null; // Not enough capacity this day
    }

    // Calculate start time: 8 AM SAST + used time
    const dayStart = new Date(date);
    dayStart.setHours(capacity.workingStartHour, 0, 0, 0);
    
    const slotStart = new Date(dayStart.getTime() + (usedMinutes * 60 * 1000));
    const slotEnd = new Date(slotStart.getTime() + (requiredMinutes * 60 * 1000));
    
    // Check if slot fits within working hours
    const workingEndTime = capacity.workingStartHour + (capacity.dailyCapacityMinutes / 60);
    const slotEndHour = slotEnd.getHours() + (slotEnd.getMinutes() / 60);
    
    if (slotEndHour <= workingEndTime) {
      console.log(`[SLOT FOUND] Stage ${stageId} on ${dateStr}: ${formatSAST(slotStart, 'HH:mm')}-${formatSAST(slotEnd, 'HH:mm')}`);
      return { start: slotStart, end: slotEnd, date: dateStr };
    }
    
    return null; // Slot exceeds working hours
  }

  /**
   * **DATABASE FALLBACK: Use new capacity-aware function**
   */
  private async findSlotUsingDatabase(
    stageId: string,
    requiredMinutes: number, 
    earliestStart: Date
  ): Promise<{ start: Date; end: Date; date: string } | null> {
    
    const startDate = formatSAST(earliestStart, 'yyyy-MM-dd');
    
    const { data, error } = await supabase.rpc('get_next_capacity_slot', {
      p_stage_id: stageId,
      p_duration_minutes: requiredMinutes,
      p_earliest_date: startDate
    });

    if (error) {
      console.error('Database capacity lookup failed:', error);
      return null;
    }

    if (data && data.length > 0) {
      const slot = data[0];
      return {
        start: toSAST(new Date(slot.start_time)),
        end: toSAST(new Date(slot.end_time)),
        date: slot.date_scheduled
      };
    }

    return null;
  }

  /**
   * **SCHEDULE MULTIPLE JOBS: Fixes the core "10 days later" bug**
   * Packs jobs within daily capacity instead of sequential queue
   */
  async scheduleMultipleJobs(requests: JobScheduleRequest[]): Promise<CapacityResult> {
    const results: ScheduledSlot[] = [];
    const errors: string[] = [];
    const capacityAnalysis: any[] = [];
    
    // Sort by priority and earliest start time
    const sortedRequests = requests.sort((a, b) => {
      const priorityDiff = (a.priority || 0) - (b.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      
      const aTime = a.earliestStart?.getTime() || 0;
      const bTime = b.earliestStart?.getTime() || 0;
      return aTime - bTime;
    });
    
    for (const request of sortedRequests) {
      try {
        const slot = await this.findNextAvailableSlot(
          request.stageId,
          request.estimatedMinutes,
          request.earliestStart
        );
        
        if (slot) {
          const scheduledSlot: ScheduledSlot = {
            jobId: request.jobId,
            stageId: request.stageId,
            scheduledStart: slot.start,
            scheduledEnd: slot.end,
            estimatedMinutes: request.estimatedMinutes,
            capacityDate: slot.date
          };
          
          results.push(scheduledSlot);
          
          // Track capacity analysis
          const usedMinutes = await this.getUsedCapacityForDate(request.stageId, slot.date);
          const stageCapacity = this.stageCapacities.get(request.stageId);
          const totalCapacity = stageCapacity?.dailyCapacityMinutes || 480; // 8 hours default
          
          capacityAnalysis.push({
            stageId: request.stageId,
            date: slot.date,
            usedMinutes: usedMinutes + request.estimatedMinutes,
            availableMinutes: totalCapacity - usedMinutes - request.estimatedMinutes,
            totalCapacity
          });
          
          console.log(`[SCHEDULED] Job ${request.jobId} in stage ${request.stageId} on ${slot.date} at ${formatSAST(slot.start, 'HH:mm')}`);
        } else {
          errors.push(`No capacity found for job ${request.jobId} in stage ${request.stageId}`);
        }
      } catch (error) {
        console.error(`Scheduling error for job ${request.jobId}:`, error);
        errors.push(`Failed to schedule job ${request.jobId}: ${error}`);
      }
    }
    
    return {
      success: errors.length === 0,
      scheduledSlots: results,
      errors,
      capacityAnalysis
    };
  }

  /**
   * **CAPACITY CHECKING: Get used minutes for stage on specific date**
   */
  private async getUsedCapacityForDate(stageId: string, dateStr: string): Promise<number> {
    const { data, error } = await supabase
      .from('job_stage_instances')
      .select('scheduled_minutes')
      .eq('production_stage_id', stageId)
      .in('status', ['pending', 'active'])
      .or(`scheduled_start_at::date.eq.${dateStr}`);

    if (error) {
      console.error('Error fetching used capacity:', error);
      return 0;
    }

    return (data || []).reduce((total, item) => {
      const minutes = item.scheduled_minutes || 0;
      return total + minutes;
    }, 0);
  }

  /**
   * **GET NEXT WORKING DAY**
   */
  private getNextWorkingDay(date: Date): Date {
    let nextDay = new Date(date);
    while (isWeekend(nextDay)) {
      nextDay = addDays(nextDay, 1);
    }
    return nextDay;
  }

  /**
   * **LOAD STAGE CAPACITIES FROM DATABASE**
   */
  static async loadCapacitiesFromDatabase(): Promise<StageCapacity[]> {
    const { data, error } = await supabase
      .from('stage_capacity_profiles')
      .select(`
        production_stage_id,
        daily_capacity_hours,
        max_parallel_jobs
      `);

    if (error) {
      console.error('Error loading stage capacities:', error);
      return [];
    }

    return (data || []).map(item => ({
      stageId: item.production_stage_id,
      dailyCapacityMinutes: item.daily_capacity_hours * 60,
      maxParallelJobs: item.max_parallel_jobs,
      workingStartHour: 8,   // 8 AM SAST
      workingEndHour: 17.5   // 5:30 PM SAST
    }));
  }
}

/**
 * **CONVENIENCE FUNCTIONS**
 */
export const createDefaultScheduler = async (): Promise<ParallelCapacityScheduler> => {
  const capacities = await ParallelCapacityScheduler.loadCapacitiesFromDatabase();
  return new ParallelCapacityScheduler(capacities);
};

export const scheduleJobsWithCapacityLogic = async (
  requests: JobScheduleRequest[]
): Promise<CapacityResult> => {
  const scheduler = await createDefaultScheduler();
  return scheduler.scheduleMultipleJobs(requests);
};