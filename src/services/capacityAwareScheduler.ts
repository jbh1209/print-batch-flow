import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isWeekend } from "date-fns";
import { WorkShiftConfigService } from "./workShiftConfig";
import { FullWorkflowScheduler } from "./fullWorkflowScheduler";

interface SchedulingJob {
  job_id: string;
  production_stage_id: string;
  estimated_duration_minutes: number;
  queue_position?: number;
}

interface DailyCapacity {
  date: string;
  stage_id: string;
  allocated_minutes: number;
  remaining_minutes: number;
}

export class CapacityAwareScheduler {
  private static readonly SHIFT_START_HOUR = 8; // 8:00 AM
  private static readonly SHIFT_END_HOUR = 16.5; // 4:30 PM
  private static readonly DAILY_CAPACITY_MINUTES = 510; // 8.5 hours (8AM-4:30PM)
  
  /**
   * Distributes jobs across available time slots respecting daily capacity limits
   * Now uses full workflow scheduling for complete job sequences
   */
  static async scheduleJobsWithCapacity(stageId?: string): Promise<boolean> {
    try {
      console.log("🔄 Starting full workflow scheduling...");
      
      // If no specific stage is requested, schedule complete job workflows
      if (!stageId) {
        return await FullWorkflowScheduler.scheduleJobWorkflows();
      }
      
      // If a specific stage is requested, use legacy single-stage scheduling
      console.log(`📋 Legacy single-stage scheduling for stage: ${stageId}`);
      
      // Get all pending jobs that need scheduling for this specific stage
      const { data: pendingJobs, error: jobsError } = await supabase
        .from('job_stage_instances')
        .select(`
          job_id,
          production_stage_id,
          estimated_duration_minutes,
          queue_position
        `)
        .eq('status', 'pending')
        .eq('job_table_name', 'production_jobs')
        .eq('production_stage_id', stageId)
        .is('scheduled_date', null)
        .order('queue_position', { ascending: true });

      if (jobsError) {
        console.error("❌ Error fetching pending jobs:", jobsError);
        return false;
      }

      if (!pendingJobs || pendingJobs.length === 0) {
        console.log("ℹ️ No pending jobs to schedule for this stage");
        return true;
      }

      console.log(`📋 Found ${pendingJobs.length} jobs to schedule for stage ${stageId}`);

      // Schedule this specific stage
      await this.scheduleStageJobs(stageId, pendingJobs);

      console.log("✅ Single-stage scheduling completed");
      return true;

    } catch (error) {
      console.error("❌ Error in capacity-aware scheduling:", error);
      return false;
    }
  }

  /**
   * Schedule jobs for a specific stage with capacity constraints
   */
  private static async scheduleStageJobs(stageId: string, jobs: SchedulingJob[]): Promise<void> {
    let currentDate = this.getNextWorkingDay(new Date());
    let currentDayAllocated = 0;
    let queuePosition = 1;

    console.log(`📅 Scheduling ${jobs.length} jobs for stage ${stageId}`);

    for (const job of jobs) {
      const duration = job.estimated_duration_minutes || 120; // Default 2 hours
      
      // Check if job fits within shift boundary (8AM to 4:30PM)
      if (currentDayAllocated + duration > this.DAILY_CAPACITY_MINUTES) {
        // Move to next working day
        currentDate = this.getNextWorkingDay(addDays(currentDate, 1));
        currentDayAllocated = 0;
        queuePosition = 1;
        console.log(`📅 Moving to next day: ${format(currentDate, 'yyyy-MM-dd')} - job exceeded shift capacity`);
      }

      // Check if job would finish after 4:30PM
      const jobEndHour = this.SHIFT_START_HOUR + (currentDayAllocated + duration) / 60;
      if (jobEndHour > this.SHIFT_END_HOUR) {
        // Job would run past 4:30PM, move to next day
        currentDate = this.getNextWorkingDay(addDays(currentDate, 1));
        currentDayAllocated = 0;
        queuePosition = 1;
        console.log(`📅 Moving to next day: ${format(currentDate, 'yyyy-MM-dd')} - job would exceed 4:30PM`);
      }

      // Calculate start and end times for this job within shift
      const startMinutes = currentDayAllocated;
      const endMinutes = startMinutes + duration;
      
      const startTime = this.minutesToTimeString(startMinutes);
      const endTime = this.minutesToTimeString(endMinutes);

      // Update the job stage instance with scheduling info (status remains 'pending')
      await this.updateJobSchedule(
        job.job_id,
        stageId,
        format(currentDate, 'yyyy-MM-dd'),
        queuePosition,
        startTime,
        endTime
      );

      // Update day allocation
      currentDayAllocated += duration;
      queuePosition++;

      console.log(`✅ Scheduled job ${job.job_id} on ${format(currentDate, 'yyyy-MM-dd')} at ${startTime}-${endTime} (pos ${queuePosition - 1})`);
    }
  }

  /**
   * Update job stage instance with scheduling information
   */
  private static async updateJobSchedule(
    jobId: string,
    stageId: string,
    scheduledDate: string,
    queuePosition: number,
    startTime: string,
    endTime: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          scheduled_date: scheduledDate,
          queue_position: queuePosition,
          scheduled_start_time: startTime,
          scheduled_end_time: endTime,
          time_slot: `${startTime}-${endTime}`,
          updated_at: new Date().toISOString()
        })
        .eq('job_id', jobId)
        .eq('production_stage_id', stageId);

      if (error) {
        console.error(`❌ Error updating schedule for job ${jobId}:`, error);
      }
    } catch (error) {
      console.error(`❌ Error in updateJobSchedule:`, error);
    }
  }

  /**
   * Group jobs by production stage
   */
  private static groupJobsByStage(jobs: SchedulingJob[]): Record<string, SchedulingJob[]> {
    return jobs.reduce((groups, job) => {
      const stageId = job.production_stage_id;
      if (!groups[stageId]) {
        groups[stageId] = [];
      }
      groups[stageId].push(job);
      return groups;
    }, {} as Record<string, SchedulingJob[]>);
  }

  /**
   * Get the next working day (skip weekends)
   */
  private static getNextWorkingDay(date: Date): Date {
    let nextDay = new Date(date);
    while (isWeekend(nextDay)) {
      nextDay = addDays(nextDay, 1);
    }
    return nextDay;
  }

  /**
   * Convert minutes to time string (HH:MM) - starts at 8:00 AM
   */
  private static minutesToTimeString(minutes: number): string {
    const totalMinutes = minutes + (this.SHIFT_START_HOUR * 60); // Add 8 hours (480 mins) for 8:00 AM start
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Clear all existing schedules and reschedule everything
   */
  static async clearAndReschedule(stageId?: string): Promise<boolean> {
    try {
      console.log("🧹 Clearing existing schedules...");
      
      // If no specific stage, use full workflow rescheduling
      if (!stageId) {
        return await FullWorkflowScheduler.clearAndRescheduleWorkflows();
      }
      
      // Clear scheduled_date for pending jobs in specific stage
      const { error: clearError } = await supabase
        .from('job_stage_instances')
        .update({
          scheduled_date: null,
          queue_position: null,
          scheduled_start_time: null,
          scheduled_end_time: null,
          time_slot: null
        })
        .eq('status', 'pending')
        .eq('job_table_name', 'production_jobs')
        .eq('production_stage_id', stageId);
      
      if (clearError) {
        console.error("❌ Error clearing schedules:", clearError);
        return false;
      }

      console.log("✅ Existing schedules cleared");
      
      // Now reschedule this specific stage
      return await this.scheduleJobsWithCapacity(stageId);
      
    } catch (error) {
      console.error("❌ Error in clearAndReschedule:", error);
      return false;
    }
  }
}