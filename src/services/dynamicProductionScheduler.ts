import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfWeek, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { stageQueueManager } from './stageQueueManager';
import { TimingCalculationService } from './timingCalculationService';
import type { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';

export interface DynamicScheduledJob {
  id: string;
  wo_no: string;
  customer: string;
  status: string;
  estimated_minutes: number;
  estimated_hours: number;
  scheduled_date: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  priority: number;
  is_expedited: boolean;
  current_stage_id: string;
  current_stage_name: string;
  stage_status: 'pending' | 'active' | 'completed';
  accessibleJob: AccessibleJob;
  due_date: Date;
  stage_order: number;
  queue_position?: number;
}

export interface DynamicDaySchedule {
  date: string;
  stage_id: string;
  stage_name: string;
  jobs: DynamicScheduledJob[];
  shifts: DynamicShiftSchedule[];
  total_hours: number;
  total_minutes: number;
  capacity_hours: number;
  capacity_minutes: number;
  utilization: number;
  is_working_day: boolean;
  available_capacity: number;
}

export interface DynamicShiftSchedule {
  shiftNumber: 1 | 2 | 3;
  startTime: string;
  endTime: string;
  capacity: number; // minutes
  used: number; // minutes
  available: number; // minutes
  jobs: DynamicJobSegment[];
}

export interface DynamicJobSegment {
  jobId: string;
  duration: number; // minutes in this shift
  isPartial: boolean;
  shiftNumber: number;
  job: DynamicScheduledJob;
  start_time: string;
  end_time: string;
}

export interface WeeklyScheduleParams {
  currentWeek: Date;
  selectedStage?: string | null;
  jobs: AccessibleJob[];
}

export class DynamicProductionScheduler {
  private static instance: DynamicProductionScheduler;

  static getInstance(): DynamicProductionScheduler {
    if (!this.instance) {
      this.instance = new DynamicProductionScheduler();
    }
    return this.instance;
  }

  /**
   * Get stage-specific jobs for the selected stage
   */
  private async getStageSpecificJobs(stageId: string, jobs: AccessibleJob[]): Promise<DynamicScheduledJob[]> {
    console.log(`🎯 Filtering jobs for stage: ${stageId}`);
    
    const stageJobs: DynamicScheduledJob[] = [];

    for (const job of jobs) {
      // Find current stage instance for this job at the selected stage
      const currentStageInstance = job.job_stage_instances?.find(
        instance => instance.production_stage_id === stageId
      );

      if (!currentStageInstance) continue;

      // Only include jobs that are at this stage (active or pending)
      if (currentStageInstance.status !== 'active' && currentStageInstance.status !== 'pending') {
        continue;
      }

      // Calculate realistic timing for this specific stage
      let estimatedMinutes = currentStageInstance.estimated_duration_minutes || 0;
      
      // If no timing data, calculate it properly
      if (estimatedMinutes === 0) {
        try {
          const timingResult = await TimingCalculationService.calculateStageTimingWithInheritance({
            quantity: job.qty || 1,
            stageId: stageId,
            specificationId: (currentStageInstance as any).stage_specification_id
          });
          estimatedMinutes = timingResult.estimatedDurationMinutes;
        } catch (error) {
          console.warn(`Failed to calculate timing for job ${job.wo_no}:`, error);
          estimatedMinutes = Math.max(30, (job.qty || 1) * 2); // Fallback: 2 mins per unit, min 30 mins
        }
      }

      const scheduledJob: DynamicScheduledJob = {
        id: job.job_id,
        wo_no: job.wo_no || 'Unknown',
        customer: job.customer || 'Unknown',
        status: job.status || 'Unknown',
        estimated_minutes: estimatedMinutes,
        estimated_hours: Math.round(estimatedMinutes / 60 * 100) / 100,
        scheduled_date: '', // Will be set during scheduling
        priority: this.calculateJobPriority(job, currentStageInstance),
        is_expedited: (job as any).is_expedited || false,
        current_stage_id: stageId,
        current_stage_name: job.display_stage_name || 'Unknown Stage',
        stage_status: currentStageInstance.status as 'pending' | 'active' | 'completed',
        accessibleJob: job,
        due_date: new Date(job.due_date),
        stage_order: currentStageInstance.stage_order || 0
      };

      stageJobs.push(scheduledJob);
    }

    console.log(`✅ Found ${stageJobs.length} jobs at stage ${stageId}`);
    return stageJobs;
  }

  /**
   * Calculate job priority based on proof approval, expedited status, and due date
   */
  private calculateJobPriority(job: AccessibleJob, stageInstance: any): number {
    let priority = 1000; // Base priority
    
    // Expedited jobs get highest priority
    if ((job as any).is_expedited) {
      priority -= 500;
    }
    
    // Proof approved jobs get higher priority
    if ((job as any).proof_approved_manually_at) {
      const approvalTime = new Date((job as any).proof_approved_manually_at).getTime();
      priority = approvalTime; // Earlier approval = higher priority
    }
    
    // Due date influence
    if (job.due_date) {
      const dueTime = new Date(job.due_date).getTime();
      priority += (dueTime / 1000000); // Convert to manageable number
    }
    
    // Stage order influence (earlier stages get slight priority)
    priority += (stageInstance.stage_order || 0) * 10;
    
    return priority;
  }

  /**
   * Generate dynamic weekly schedule for a specific stage
   */
  async generateWeeklySchedule(params: WeeklyScheduleParams): Promise<DynamicDaySchedule[]> {
    const { currentWeek, selectedStage, jobs } = params;
    
    if (!selectedStage) {
      console.warn('⚠️ No stage selected for scheduling');
      return [];
    }

    console.log(`🗓️ Generating weekly schedule for ${selectedStage}, week of ${format(currentWeek, 'MMM dd, yyyy')}`);

    // Get stage ID from stage name
    const { data: stageData, error: stageError } = await supabase
      .from('production_stages')
      .select('id, name')
      .eq('name', selectedStage)
      .single();

    if (stageError || !stageData) {
      console.error('Failed to find stage:', selectedStage, stageError);
      return [];
    }

    const stageId = stageData.id;
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
    const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

    // Get stage-specific jobs
    const stageJobs = await this.getStageSpecificJobs(stageId, jobs);
    
    // Sort jobs by priority (expedited first, then by approval date/due date)
    const sortedJobs = stageJobs.sort((a, b) => {
      if (a.is_expedited !== b.is_expedited) {
        return a.is_expedited ? -1 : 1;
      }
      return a.priority - b.priority;
    });

    console.log(`📋 Scheduling ${sortedJobs.length} jobs for stage ${selectedStage}`);

    // Initialize daily schedules
    const DAILY_CAPACITY = 480; // 8 hours in minutes
    const dailySchedules: DynamicDaySchedule[] = weekDays.map(date => ({
      date: format(date, 'yyyy-MM-dd'),
      stage_id: stageId,
      stage_name: selectedStage,
      jobs: [],
      shifts: [],
      total_hours: 0,
      total_minutes: 0,
      capacity_hours: 8,
      capacity_minutes: DAILY_CAPACITY,
      utilization: 0,
      is_working_day: true,
      available_capacity: DAILY_CAPACITY
    }));

    // Dynamic scheduling: distribute jobs realistically across the week
    await this.distributeJobsAcrossWeek(sortedJobs, dailySchedules);

    // Calculate shifts for each day
    return dailySchedules.map(day => ({
      ...day,
      shifts: this.calculateDayShifts(day.jobs, day.available_capacity)
    }));
  }

  /**
   * Distribute jobs across the week based on capacity and timing constraints
   */
  private async distributeJobsAcrossWeek(
    sortedJobs: DynamicScheduledJob[],
    dailySchedules: DynamicDaySchedule[]
  ): Promise<void> {
    let currentDayIndex = 0;
    let queuePosition = 1;

    for (const job of sortedJobs) {
      let remainingWork = job.estimated_minutes;
      let jobScheduled = false;

      // Try to fit the job starting from current day
      while (remainingWork > 0 && currentDayIndex < dailySchedules.length) {
        const day = dailySchedules[currentDayIndex];
        
        if (day.available_capacity > 0) {
          const workToAssign = Math.min(remainingWork, day.available_capacity);
          
          const scheduledJob: DynamicScheduledJob = {
            ...job,
            estimated_minutes: workToAssign,
            estimated_hours: Math.round(workToAssign / 60 * 100) / 100,
            scheduled_date: day.date,
            queue_position: queuePosition
          };
          
          day.jobs.push(scheduledJob);
          day.available_capacity -= workToAssign;
          day.total_minutes += workToAssign;
          day.total_hours = Math.round(day.total_minutes / 60 * 100) / 100;
          day.utilization = Math.round((day.total_minutes / day.capacity_minutes) * 100);
          
          remainingWork -= workToAssign;
          jobScheduled = true;
        }

        // If current day is full, move to next day
        if (day.available_capacity <= 0) {
          currentDayIndex++;
        }
      }

      // If job couldn't be fully scheduled within the week, note overflow
      if (remainingWork > 0) {
        console.warn(`⚠️ Job ${job.wo_no} has ${remainingWork} minutes overflow beyond this week`);
      }

      if (jobScheduled) {
        queuePosition++;
      }
    }
  }

  /**
   * Calculate shift distribution for a day
   */
  private calculateDayShifts(dayJobs: DynamicScheduledJob[], availableCapacity: number): DynamicShiftSchedule[] {
    const SHIFT_CAPACITY = 480; // 8 hours in minutes
    const shifts: DynamicShiftSchedule[] = [
      { 
        shiftNumber: 1, 
        startTime: '06:00', 
        endTime: '14:00', 
        capacity: SHIFT_CAPACITY, 
        used: 0, 
        available: SHIFT_CAPACITY,
        jobs: [] 
      },
      { 
        shiftNumber: 2, 
        startTime: '14:00', 
        endTime: '22:00', 
        capacity: SHIFT_CAPACITY, 
        used: 0, 
        available: SHIFT_CAPACITY,
        jobs: [] 
      },
      { 
        shiftNumber: 3, 
        startTime: '22:00', 
        endTime: '06:00', 
        capacity: SHIFT_CAPACITY, 
        used: 0, 
        available: SHIFT_CAPACITY,
        jobs: [] 
      }
    ];

    let currentShiftIndex = 0;
    let currentTime = 6 * 60; // Start at 06:00 in minutes

    for (const job of dayJobs) {
      let remainingDuration = job.estimated_minutes;

      while (remainingDuration > 0 && currentShiftIndex < shifts.length) {
        const currentShift = shifts[currentShiftIndex];
        
        if (currentShift.available <= 0) {
          currentShiftIndex++;
          currentTime = this.getShiftStartTime(currentShiftIndex);
          continue;
        }

        const durationForThisShift = Math.min(remainingDuration, currentShift.available);
        const startTime = this.formatTime(currentTime);
        currentTime += durationForThisShift;
        const endTime = this.formatTime(currentTime);

        const jobSegment: DynamicJobSegment = {
          jobId: job.id,
          duration: durationForThisShift,
          isPartial: durationForThisShift < remainingDuration,
          shiftNumber: currentShift.shiftNumber,
          job,
          start_time: startTime,
          end_time: endTime
        };

        currentShift.jobs.push(jobSegment);
        currentShift.used += durationForThisShift;
        currentShift.available -= durationForThisShift;
        remainingDuration -= durationForThisShift;

        // If shift is full, move to next shift
        if (currentShift.available <= 0) {
          currentShiftIndex++;
          currentTime = this.getShiftStartTime(currentShiftIndex);
        }
      }
    }

    return shifts;
  }

  /**
   * Get shift start time in minutes from midnight
   */
  private getShiftStartTime(shiftIndex: number): number {
    const startTimes = [6 * 60, 14 * 60, 22 * 60]; // 06:00, 14:00, 22:00
    return startTimes[shiftIndex] || 6 * 60;
  }

  /**
   * Format minutes since midnight as HH:MM
   */
  private formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Update job progression (called nightly or after stage completion)
   */
  async updateJobProgression(): Promise<{
    advancedJobs: number;
    delayedJobs: number;
    rescheduleRequests: number;
  }> {
    console.log('🔄 Updating job progression...');
    
    let advancedJobs = 0;
    let delayedJobs = 0;
    let rescheduleRequests = 0;

    try {
      // Get all active stage instances that should have been completed
      const { data: overdueStages, error } = await supabase
        .from('job_stage_instances')
        .select(`
          id, job_id, job_table_name, production_stage_id,
          started_at, estimated_duration_minutes,
          production_jobs!inner(wo_no, due_date)
        `)
        .eq('status', 'active')
        .not('started_at', 'is', null);

      if (error) {
        console.error('Error fetching active stages:', error);
        return { advancedJobs: 0, delayedJobs: 0, rescheduleRequests: 0 };
      }

      const now = new Date();

      for (const stage of overdueStages || []) {
        const startedAt = new Date(stage.started_at);
        const estimatedCompletionTime = new Date(
          startedAt.getTime() + (stage.estimated_duration_minutes * 60 * 1000)
        );

        // Check if stage should have been completed by now
        if (now > estimatedCompletionTime) {
          // Mark as delayed and add to due date recalculation queue
          await supabase
            .from('due_date_recalculation_queue')
            .insert({
              job_id: stage.job_id,
              job_table_name: stage.job_table_name,
              trigger_reason: 'stage_overrun_detected'
            });

          delayedJobs++;
          rescheduleRequests++;
          
          console.log(`⚠️ Stage overrun detected for job ${(stage as any).production_jobs.wo_no}`);
        }
      }

      // Trigger due date recalculation for affected jobs
      if (rescheduleRequests > 0) {
        await supabase.rpc('process_due_date_recalculation_queue');
      }

      return { advancedJobs, delayedJobs, rescheduleRequests };
    } catch (error) {
      console.error('Error updating job progression:', error);
      return { advancedJobs: 0, delayedJobs: 0, rescheduleRequests: 0 };
    }
  }

  /**
   * Recalculate schedule when jobs are moved or completed
   */
  async recalculateScheduleImpact(
    jobId: string, 
    oldDate: string, 
    newDate: string
  ): Promise<{
    impactedJobs: string[];
    utilizationChanges: Array<{
      date: string;
      oldUtilization: number;
      newUtilization: number;
    }>;
  }> {
    console.log(`📊 Recalculating schedule impact for job ${jobId}: ${oldDate} → ${newDate}`);
    
    // This would involve complex capacity recalculation
    // For now, returning placeholder - can be enhanced based on needs
    return {
      impactedJobs: [],
      utilizationChanges: []
    };
  }
}

export const dynamicProductionScheduler = DynamicProductionScheduler.getInstance();