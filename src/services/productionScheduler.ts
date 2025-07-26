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
   */
  static async calculateSmartDueDate(
    estimatedHours: number,
    priority: number = 100
  ): Promise<SchedulingResult> {
    try {
      // Use the database function for smart scheduling
      const { data, error } = await supabase
        .rpc('calculate_smart_due_date', {
          p_estimated_hours: estimatedHours,
          p_priority: priority
        });

      if (error) {
        console.error('Error calculating smart due date:', error);
        // Fallback to simple calculation
        return this.calculateFallbackSchedule(estimatedHours);
      }

      // Get current workload
      const workloadQueue = await this.getCurrentWorkloadDays();
      
      const today = new Date();
      const scheduledStart = new Date(today);
      scheduledStart.setDate(today.getDate() + workloadQueue);
      
      return {
        scheduledStartDate: data || scheduledStart.toISOString().split('T')[0],
        scheduledCompletionDate: data || scheduledStart.toISOString().split('T')[0],
        estimatedTotalHours: estimatedHours,
        workloadQueue
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
   * Create or update job scheduling record
   */
  static async scheduleJob(data: JobSchedulingData): Promise<boolean> {
    try {
      const estimatedHours = data.estimatedTotalHours || 
        await this.calculateJobTotalHours(data.jobId, data.jobTableName);
      
      const scheduling = await this.calculateSmartDueDate(estimatedHours, data.priority);

      // Insert/update job scheduling record
      const { error } = await supabase
        .from('job_scheduling')
        .upsert({
          job_id: data.jobId,
          job_table_name: data.jobTableName,
          scheduled_start_date: scheduling.scheduledStartDate,
          scheduled_completion_date: scheduling.scheduledCompletionDate,
          estimated_total_hours: estimatedHours,
          schedule_priority: data.priority || 100,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('job_id', data.jobId)
        .eq('job_table_name', data.jobTableName);

      if (error) {
        console.error('Error scheduling job:', error);
        return false;
      }

      // Update daily workload
      await this.updateDailyWorkload(scheduling.scheduledStartDate, estimatedHours);
      
      console.log(`✅ Job ${data.jobId} scheduled for ${scheduling.scheduledStartDate}`);
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
          // Get the scheduled date for reporting
          const { data } = await supabase
            .from('job_scheduling')
            .select('scheduled_start_date')
            .eq('job_id', job.jobId)
            .eq('job_table_name', job.jobTableName)
            .single();
          
          results.push({
            jobId: job.jobId,
            success: true,
            scheduledDate: data?.scheduled_start_date
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
   * Get current workload in days
   */
  private static async getCurrentWorkloadDays(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('job_scheduling')
        .select('estimated_total_hours')
        .gte('scheduled_start_date', new Date().toISOString().split('T')[0]);

      if (error || !data) {
        return 0;
      }

      const totalHours = data.reduce((sum, job) => sum + (job.estimated_total_hours || 0), 0);
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
   */
  private static async calculateFallbackSchedule(estimatedHours: number): Promise<SchedulingResult> {
    const today = new Date();
    const workloadDays = Math.ceil(estimatedHours / 8);
    
    try {
      const completionDate = await addWorkingDays(today, workloadDays);
      return {
        scheduledStartDate: today.toISOString().split('T')[0],
        scheduledCompletionDate: completionDate.toISOString().split('T')[0],
        estimatedTotalHours: estimatedHours,
        workloadQueue: workloadDays
      };
    } catch (error) {
      // Ultimate fallback
      const fallbackDate = new Date(today);
      fallbackDate.setDate(today.getDate() + workloadDays);
      
      return {
        scheduledStartDate: today.toISOString().split('T')[0],
        scheduledCompletionDate: fallbackDate.toISOString().split('T')[0],
        estimatedTotalHours: estimatedHours,
        workloadQueue: workloadDays
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