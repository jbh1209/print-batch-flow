import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isWeekend } from "date-fns";

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
  private static readonly DAILY_CAPACITY_MINUTES = 480; // 8 hours per day per stage
  
  /**
   * Distributes jobs across available time slots respecting daily capacity limits
   */
  static async scheduleJobsWithCapacity(stageId?: string): Promise<boolean> {
    try {
      console.log("🔄 Starting capacity-aware scheduling...");
      
      // Get all pending jobs that need scheduling
      let jobQuery = supabase
        .from('job_stage_instances')
        .select(`
          job_id,
          production_stage_id,
          estimated_duration_minutes,
          queue_position
        `)
        .eq('status', 'pending')
        .eq('job_table_name', 'production_jobs')
        .is('scheduled_date', null);

      if (stageId) {
        jobQuery = jobQuery.eq('production_stage_id', stageId);
      }

      const { data: pendingJobs, error: jobsError } = await jobQuery
        .order('queue_position', { ascending: true });

      if (jobsError) {
        console.error("❌ Error fetching pending jobs:", jobsError);
        return false;
      }

      if (!pendingJobs || pendingJobs.length === 0) {
        console.log("ℹ️ No pending jobs to schedule");
        return true;
      }

      console.log(`📋 Found ${pendingJobs.length} jobs to schedule`);

      // Group jobs by stage
      const jobsByStage = this.groupJobsByStage(pendingJobs);
      
      // Schedule each stage independently
      for (const [stageId, jobs] of Object.entries(jobsByStage)) {
        await this.scheduleStageJobs(stageId, jobs);
      }

      console.log("✅ Capacity-aware scheduling completed");
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
      
      // Check if job fits in current day
      if (currentDayAllocated + duration > this.DAILY_CAPACITY_MINUTES) {
        // Move to next working day
        currentDate = this.getNextWorkingDay(addDays(currentDate, 1));
        currentDayAllocated = 0;
        queuePosition = 1;
        console.log(`📅 Moving to next day: ${format(currentDate, 'yyyy-MM-dd')}`);
      }

      // Calculate start and end times for this job
      const startMinutes = currentDayAllocated;
      const endMinutes = startMinutes + duration;
      
      const startTime = this.minutesToTimeString(startMinutes);
      const endTime = this.minutesToTimeString(endMinutes);

      // Update the job stage instance with scheduling info
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
   * Convert minutes to time string (HH:MM)
   */
  private static minutesToTimeString(minutes: number): string {
    const hours = Math.floor(minutes / 60) + 8; // Start at 8:00 AM
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Clear all existing schedules and reschedule everything
   */
  static async clearAndReschedule(stageId?: string): Promise<boolean> {
    try {
      console.log("🧹 Clearing existing schedules...");
      
      // Clear scheduled_date for pending jobs
      let clearQuery = supabase
        .from('job_stage_instances')
        .update({
          scheduled_date: null,
          queue_position: null,
          scheduled_start_time: null,
          scheduled_end_time: null,
          time_slot: null
        })
        .eq('status', 'pending')
        .eq('job_table_name', 'production_jobs');

      if (stageId) {
        clearQuery = clearQuery.eq('production_stage_id', stageId);
      }

      const { error: clearError } = await clearQuery;
      
      if (clearError) {
        console.error("❌ Error clearing schedules:", clearError);
        return false;
      }

      console.log("✅ Existing schedules cleared");
      
      // Now reschedule everything
      return await this.scheduleJobsWithCapacity(stageId);
      
    } catch (error) {
      console.error("❌ Error in clearAndReschedule:", error);
      return false;
    }
  }
}