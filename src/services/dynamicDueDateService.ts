import { supabase } from "@/integrations/supabase/client";
import { stageQueueManager } from "./stageQueueManager";
import { calculateWorkingDays, addWorkingDays } from "@/utils/tracker/workingDayCalculations";

interface DueDateWarningLevel {
  level: 'green' | 'amber' | 'red' | 'critical';
  daysOverdue: number;
  description: string;
}

export class DynamicDueDateService {
  /**
   * Calculate initial due date with 1-day buffer for new jobs
   */
  async calculateInitialDueDate(
    jobId: string, 
    jobTableName: string = 'production_jobs'
  ): Promise<{
    internalCompletionDate: Date;
    dueDateWithBuffer: Date;
    bufferDays: number;
    totalWorkingDays: number;
  } | null> {
    try {
      console.log(`[DUE DATE SERVICE] Calculating initial due date for job ${jobId}`);
      
      const timeline = await stageQueueManager.calculateJobTimeline(jobId, jobTableName);
      
      if (!timeline || !timeline.stages || timeline.stages.length === 0) {
        console.error(`[DUE DATE SERVICE] No timeline data for job ${jobId}`);
        return null;
      }
      
      console.log(`[DUE DATE SERVICE] Job ${jobId} timeline: ${timeline.stages.length} stages, ${timeline.totalEstimatedWorkingDays} working days`);
      
      // Get the realistic completion date based on current workload
      const internalCompletionDate = timeline.stages.length > 0 
        ? timeline.stages[timeline.stages.length - 1].estimatedCompletionDate
        : new Date();
      
      // Add 1 working day buffer (configurable per job)
      const bufferDays = 1;
      const dueDateWithBuffer = addWorkingDays(internalCompletionDate, bufferDays);
      
      console.log(`[DUE DATE SERVICE] Job ${jobId} completion: ${internalCompletionDate.toISOString()}, due date with buffer: ${dueDateWithBuffer.toISOString()}`);
      
      return {
        internalCompletionDate,
        dueDateWithBuffer,
        bufferDays,
        totalWorkingDays: timeline.totalEstimatedWorkingDays
      };
    } catch (error) {
      console.error(`[DUE DATE SERVICE] Error calculating due date for job ${jobId}:`, error);
      return null;
    }
  }

  /**
   * Recalculate internal completion dates and update warning levels
   */
  async recalculateJobDueDates(jobIds?: string[]): Promise<{
    updated: number;
    warnings: Array<{
      jobId: string;
      woNo: string;
      warningLevel: string;
      daysOverdue: number;
    }>;
  }> {
    let query = supabase
      .from('production_jobs')
      .select('id, wo_no, due_date, due_date_locked, last_due_date_check')
      .neq('status', 'completed');
    
    if (jobIds && jobIds.length > 0) {
      query = query.in('id', jobIds);
    } else {
      // Only recalculate jobs that haven't been checked in the last hour
      query = query.lt('last_due_date_check', new Date(Date.now() - 60 * 60 * 1000).toISOString());
    }
    
    const { data: jobs, error } = await query;
    
    if (error || !jobs) {
      console.error('Error fetching jobs for due date recalculation:', error);
      return { updated: 0, warnings: [] };
    }

    const warnings: Array<{
      jobId: string;
      woNo: string;
      warningLevel: string;
      daysOverdue: number;
    }> = [];
    
    let updated = 0;

    for (const job of jobs) {
      if (job.due_date_locked) {
        // Skip locked due dates, but still check for warnings
        continue;
      }

      try {
        const timeline = await stageQueueManager.calculateJobTimeline(job.id, 'production_jobs');
        
        const newInternalDate = timeline.stages.length > 0 
          ? timeline.stages[timeline.stages.length - 1].estimatedCompletionDate
          : new Date();
        
        const warningInfo = this.calculateWarningLevel(new Date(job.due_date), newInternalDate);
        
        // Update the job's internal completion date and warning level
        const { error: updateError } = await supabase
          .from('production_jobs')
          .update({
            internal_completion_date: newInternalDate.toISOString().split('T')[0],
            due_date_warning_level: warningInfo.level,
            last_due_date_check: new Date().toISOString()
          })
          .eq('id', job.id);
        
        if (!updateError) {
          updated++;
          
          if (warningInfo.level !== 'green') {
            warnings.push({
              jobId: job.id,
              woNo: job.wo_no,
              warningLevel: warningInfo.level,
              daysOverdue: warningInfo.daysOverdue
            });
          }
        }
      } catch (error) {
        console.error(`Error recalculating due date for job ${job.id}:`, error);
      }
    }

    return { updated, warnings };
  }

  /**
   * Calculate warning level based on due date vs internal completion date
   */
  private calculateWarningLevel(dueDate: Date, internalCompletionDate: Date): DueDateWarningLevel {
    const dueDateWorkingDays = calculateWorkingDays(0); // Get working day utility
    
    // Calculate working days difference
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysDiff = Math.ceil((internalCompletionDate.getTime() - dueDate.getTime()) / msPerDay);
    
    if (daysDiff <= 0) {
      return {
        level: 'green',
        daysOverdue: 0,
        description: 'On track'
      };
    } else if (daysDiff === 1) {
      return {
        level: 'amber',
        daysOverdue: daysDiff,
        description: 'Due date at risk'
      };
    } else if (daysDiff <= 2) {
      return {
        level: 'red',
        daysOverdue: daysDiff,
        description: 'Due date exceeded'
      };
    } else {
      return {
        level: 'critical',
        daysOverdue: daysDiff,
        description: 'Significantly overdue'
      };
    }
  }

  /**
   * Get jobs with due date warnings for management dashboard
   */
  async getJobsWithWarnings(): Promise<Array<{
    id: string;
    wo_no: string;
    customer: string;
    due_date: string;
    internal_completion_date: string;
    due_date_warning_level: string;
    days_overdue: number;
  }>> {
    const { data: jobs, error } = await supabase
      .from('production_jobs')
      .select('id, wo_no, customer, due_date, internal_completion_date, due_date_warning_level')
      .neq('due_date_warning_level', 'green')
      .neq('status', 'completed')
      .order('due_date_warning_level', { ascending: false })
      .order('due_date');
    
    if (error || !jobs) {
      console.error('Error fetching jobs with warnings:', error);
      return [];
    }

    return jobs.map(job => {
      const daysOverdue = job.internal_completion_date && job.due_date
        ? Math.ceil((new Date(job.internal_completion_date).getTime() - new Date(job.due_date).getTime()) / (24 * 60 * 60 * 1000))
        : 0;
      
      return {
        ...job,
        days_overdue: Math.max(0, daysOverdue)
      };
    });
  }

  /**
   * Trigger due date recalculation for all jobs affected by production changes
   */
  async triggerRecalculationForAffectedJobs(stageId?: string, jobId?: string): Promise<void> {
    // This would be called when:
    // - A job stage is completed
    // - A job is expedited
    // - Machine downtime occurs
    // - Queue positions change
    
    console.log('Triggering due date recalculation for affected jobs...');
    
    if (jobId) {
      // Recalculate specific job
      await this.recalculateJobDueDates([jobId]);
    } else if (stageId) {
      // Recalculate all jobs with pending stages for this production stage
      const { data: affectedJobs } = await supabase
        .from('job_stage_instances')
        .select('job_id')
        .eq('production_stage_id', stageId)
        .in('status', ['pending', 'active']);
      
      if (affectedJobs && affectedJobs.length > 0) {
        const jobIds = affectedJobs.map(j => j.job_id);
        await this.recalculateJobDueDates(jobIds);
      }
    } else {
      // Full recalculation (should be run periodically)
      await this.recalculateJobDueDates();
    }
  }
}

export const dynamicDueDateService = new DynamicDueDateService();