import { supabase } from "@/integrations/supabase/client";
import { TimingCalculationService } from "./timingCalculationService";
import { isWorkingDay, addWorkingDays } from "@/utils/dateCalculations";

export interface SchedulingResult {
  scheduledStartDate: string;
  scheduledCompletionDate: string;
  estimatedTotalHours: number;
  workloadQueue: number; // Days of work already scheduled
}

export interface JobSchedulingData {
  jobId: string;
  jobTableName: string;
  estimatedTotalHours?: number;
  priority?: number;
}

export class ProductionScheduler {
  /**
   * Calculate smart due date based on current workload and estimated hours
   * Includes 1-day production buffer for client reliability
   */
  static async calculateSmartDueDate(
    estimatedHours: number,
    priority: number = 100
  ): Promise<SchedulingResult> {
    try {
      // Get current workload in days
      const workloadQueue = await this.getCurrentWorkloadDays();
      const jobDays = Math.ceil(estimatedHours / 8); // 8 hours per working day
      
      const today = new Date();
      const scheduledStart = new Date(today);
      scheduledStart.setDate(today.getDate() + workloadQueue);
      
      // Add job duration + 1 day buffer to completion date
      const scheduledCompletion = await addWorkingDays(scheduledStart, jobDays + 1);
      
      return {
        scheduledStartDate: scheduledStart.toISOString().split('T')[0],
        scheduledCompletionDate: scheduledCompletion.toISOString().split('T')[0],
        estimatedTotalHours: estimatedHours,
        workloadQueue: workloadQueue + jobDays + 1 // Include buffer in queue
      };
    } catch (error) {
      console.error('Error in smart due date calculation:', error);
      return this.calculateFallbackSchedule(estimatedHours);
    }
  }

  /**
   * Calculate estimated total hours for a job based on its stages
   */
  static async calculateJobTotalHours(
    jobId: string,
    jobTableName: string,
    categoryId?: string
  ): Promise<number> {
    try {
      // Get all stage instances for this job
      const { data: stageInstances, error } = await supabase
        .from('job_stage_instances')
        .select(`
          estimated_duration_minutes,
          production_stages:production_stage_id(
            running_speed_per_hour,
            make_ready_time_minutes,
            speed_unit
          )
        `)
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName);

      if (error || !stageInstances) {
        console.error('Error fetching stage instances:', error);
        return 8; // Default 1 day
      }

      // Sum up all estimated durations
      let totalMinutes = 0;
      
      for (const stage of stageInstances) {
        if (stage.estimated_duration_minutes) {
          totalMinutes += stage.estimated_duration_minutes;
        } else if (stage.production_stages) {
          // Use default timing calculation if no specific estimate
          totalMinutes += stage.production_stages.make_ready_time_minutes || 60;
        }
      }

      // Convert to hours and round up
      return Math.ceil(totalMinutes / 60) || 8;
    } catch (error) {
      console.error('Error calculating job total hours:', error);
      return 8; // Default fallback
    }
  }

  /**
   * Calculate and update job due date using due_date_recalculation_queue
   */
  static async scheduleJob(data: JobSchedulingData): Promise<boolean> {
    try {
      const estimatedHours = data.estimatedTotalHours || 
        await this.calculateJobTotalHours(data.jobId, data.jobTableName);
      
      const scheduling = await this.calculateSmartDueDate(estimatedHours, data.priority);

      // Add to due date recalculation queue for processing
      const { error } = await supabase
        .from('due_date_recalculation_queue')
        .insert({
          job_id: data.jobId,
          job_table_name: data.jobTableName,
          trigger_reason: 'manual_scheduling',
          processed: false
        });

      if (error) {
        console.error('Error adding job to recalculation queue:', error);
        return false;
      }

      // Update daily workload
      await this.updateDailyWorkload(scheduling.scheduledStartDate, estimatedHours);
      
      console.log(`✅ Job ${data.jobId} added to scheduling queue`);
      return true;
    } catch (error) {
      console.error('Error in scheduleJob:', error);
      return false;
    }
  }

  /**
   * Batch schedule multiple jobs (for Excel import)
   */
  static async batchScheduleJobs(jobs: JobSchedulingData[]): Promise<{
    successful: number;
    failed: number;
    results: Array<{ jobId: string; success: boolean; scheduledDate?: string }>
  }> {
    const results = [];
    let successful = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        const success = await this.scheduleJob(job);
        if (success) {
          successful++;
          results.push({
            jobId: job.jobId,
            success: true,
            scheduledDate: 'queued_for_calculation'
          });
        } else {
          failed++;
          results.push({ jobId: job.jobId, success: false });
        }
      } catch (error) {
        failed++;
        results.push({ jobId: job.jobId, success: false });
        console.error(`Failed to schedule job ${job.jobId}:`, error);
      }
    }

    console.log(`📊 Batch scheduling complete: ${successful} successful, ${failed} failed`);
    return { successful, failed, results };
  }

  /**
   * Get current workload in days from daily_workload table
   */
  private static async getCurrentWorkloadDays(): Promise<number> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_workload')
        .select('total_estimated_hours')
        .gte('date', today)
        .order('date');

      if (error || !data) {
        return 0;
      }

      const totalHours = data.reduce((sum, day) => sum + (day.total_estimated_hours || 0), 0);
      return Math.ceil(totalHours / 8); // 8 hours per day
    } catch (error) {
      console.error('Error getting current workload:', error);
      return 0;
    }
  }

  /**
   * Update daily workload tracking
   */
  private static async updateDailyWorkload(date: string, hours: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('daily_workload')
        .upsert({
          date,
          total_jobs: 1,
          total_estimated_hours: hours
        }, {
          onConflict: 'date',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Error updating daily workload:', error);
      }
    } catch (error) {
      console.error('Error in updateDailyWorkload:', error);
    }
  }

  /**
   * Fallback scheduling when database function fails
   * Includes 1-day production buffer
   */
  private static async calculateFallbackSchedule(estimatedHours: number): Promise<SchedulingResult> {
    const today = new Date();
    const workloadDays = Math.ceil(estimatedHours / 8);
    
    try {
      // Add 1 day buffer to completion date
      const completionDate = await addWorkingDays(today, workloadDays + 1);
      return {
        scheduledStartDate: today.toISOString().split('T')[0],
        scheduledCompletionDate: completionDate.toISOString().split('T')[0],
        estimatedTotalHours: estimatedHours,
        workloadQueue: workloadDays + 1 // Include buffer
      };
    } catch (error) {
      // Ultimate fallback
      const fallbackDate = new Date(today);
      fallbackDate.setDate(today.getDate() + workloadDays + 1); // Add buffer
      
      return {
        scheduledStartDate: today.toISOString().split('T')[0],
        scheduledCompletionDate: fallbackDate.toISOString().split('T')[0],
        estimatedTotalHours: estimatedHours,
        workloadQueue: workloadDays + 1 // Include buffer
      };
    }
  }

  /**
   * Get production schedule overview
   */
  static async getScheduleOverview(startDate: string, endDate: string) {
    try {
      const { data, error } = await supabase
        .from('daily_workload')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');

      if (error) {
        console.error('Error fetching schedule overview:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getScheduleOverview:', error);
      return [];
    }
  }
}