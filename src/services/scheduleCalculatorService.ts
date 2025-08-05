import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfWeek, isWeekend } from "date-fns";
import { advancedSchedulingEngine } from "./advancedSchedulingEngine";
import { stageQueueManager } from "./stageQueueManager";

export interface ScheduledJob {
  job_id: string;
  wo_no: string;
  customer: string;
  status: string;
  current_stage_id: string;
  current_stage_name: string;
  current_stage_status: string;
  current_stage_color?: string;
  scheduledDate: string;
  queuePosition: number;
  estimatedStartDate?: string;
  estimatedCompletionDate?: string;
  isBottleneck: boolean;
  display_stage_name: string;
  workflow_progress: number;
  due_date?: string;
  qty?: number;
  user_can_work: boolean;
}

export interface JobsByDate {
  [dateKey: string]: ScheduledJob[];
}

class ScheduleCalculatorService {
  /**
   * Fetches jobs and calculates their schedules using the existing advanced scheduling engine
   */
  async calculateJobSchedules(): Promise<{ jobs: ScheduledJob[]; jobsByDate: JobsByDate }> {
    try {
      // Get all accessible jobs using the existing hook's query
      const { data: jobs, error } = await supabase.rpc('get_user_accessible_jobs', {
        p_permission_type: 'work',
        p_status_filter: null
      });

      if (error) {
        console.error('Error fetching jobs:', error);
        return { jobs: [], jobsByDate: {} };
      }

      if (!jobs || jobs.length === 0) {
        return { jobs: [], jobsByDate: {} };
      }

      // Calculate advanced schedules for each job
      const jobsWithScheduling: ScheduledJob[] = [];

      for (const job of jobs) {
        try {
          // Use the existing advanced scheduling engine
          const advancedSchedule = await advancedSchedulingEngine.calculateAdvancedSchedule(
            job.job_id,
            'production_jobs'
          );

          // Determine scheduled date based on approval timestamp order and shift capacity
          const scheduledDate = await this.calculateScheduledDate(
            job.current_stage_id,
            job.job_id,
            job.current_stage_status
          );

          const scheduledJob: ScheduledJob = {
            ...job,
            scheduledDate: format(scheduledDate, 'yyyy-MM-dd'),
            queuePosition: advancedSchedule?.queuePositions?.[0]?.position || 1,
            estimatedStartDate: advancedSchedule?.estimatedStartDate ? 
              format(new Date(advancedSchedule.estimatedStartDate), 'yyyy-MM-dd') : undefined,
            estimatedCompletionDate: advancedSchedule?.estimatedCompletionDate ? 
              format(new Date(advancedSchedule.estimatedCompletionDate), 'yyyy-MM-dd') : undefined,
            isBottleneck: advancedSchedule?.bottleneckStages?.some(
              (stage: any) => stage.stageId === job.current_stage_id
            ) || false,
            display_stage_name: job.current_stage_name,
            user_can_work: job.user_can_work || false
          };

          jobsWithScheduling.push(scheduledJob);

        } catch (scheduleError) {
          console.warn(`Failed to calculate schedule for job ${job.wo_no}:`, scheduleError);
          
          // Fallback to basic job data
          const fallbackDate = new Date();
          const scheduledJob: ScheduledJob = {
            ...job,
            scheduledDate: format(fallbackDate, 'yyyy-MM-dd'),
            queuePosition: 1,
            isBottleneck: false,
            display_stage_name: job.current_stage_name,
            user_can_work: job.user_can_work || false
          };

          jobsWithScheduling.push(scheduledJob);
        }
      }

      // Group jobs by scheduled date and sort within each date
      const jobsByDate: JobsByDate = {};
      
      jobsWithScheduling.forEach(job => {
        const dateKey = job.scheduledDate;
        
        if (!jobsByDate[dateKey]) {
          jobsByDate[dateKey] = [];
        }
        
        jobsByDate[dateKey].push(job);
      });

      // Sort jobs within each date by bottleneck priority, then queue position
      Object.keys(jobsByDate).forEach(dateKey => {
        jobsByDate[dateKey].sort((a, b) => {
          // Bottleneck jobs first
          if (a.isBottleneck !== b.isBottleneck) {
            return a.isBottleneck ? -1 : 1;
          }
          // Then by queue position
          return a.queuePosition - b.queuePosition;
        });
      });

      return { jobs: jobsWithScheduling, jobsByDate };

    } catch (error) {
      console.error('Error in calculateJobSchedules:', error);
      return { jobs: [], jobsByDate: {} };
    }
  }

  /**
   * Calculate the scheduled date for a job based on stage queue and shift configuration
   */
  private async calculateScheduledDate(
    stageId: string, 
    jobId: string, 
    status: string
  ): Promise<Date> {
    try {
      // Get stage workload data
      const stageWorkload = await stageQueueManager.getStageWorkload(stageId);
      
      if (!stageWorkload) {
        return this.getNextWorkingDay(new Date());
      }

      // Calculate queue processing time in days
      const queueDays = Math.ceil(stageWorkload.queueDaysToProcess || 0);
      
      // Start from today and add queue days
      let targetDate = new Date();
      
      for (let i = 0; i < queueDays; i++) {
        targetDate = this.getNextWorkingDay(targetDate);
        if (i < queueDays - 1) {
          targetDate = addDays(targetDate, 1);
        }
      }

      return targetDate;

    } catch (error) {
      console.error('Error calculating scheduled date:', error);
      return this.getNextWorkingDay(new Date());
    }
  }

  /**
   * Get the next working day (Monday-Friday)
   */
  private getNextWorkingDay(fromDate: Date): Date {
    let nextDay = new Date(fromDate);
    
    while (isWeekend(nextDay)) {
      nextDay = addDays(nextDay, 1);
    }
    
    return nextDay;
  }

  /**
   * Update the queue position when jobs are rescheduled via drag-and-drop
   */
  async rescheduleJob(
    jobId: string, 
    newDate: Date, 
    newQueuePosition: number = 1
  ): Promise<boolean> {
    try {
      // Update the scheduled_date and queue_position in production_jobs table
      const { error } = await supabase
        .from('production_jobs')
        .update({
          scheduled_date: format(newDate, 'yyyy-MM-dd'),
          queue_position: newQueuePosition,
          last_scheduled_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) {
        console.error('Error rescheduling job:', error);
        return false;
      }

      return true;

    } catch (error) {
      console.error('Error in rescheduleJob:', error);
      return false;
    }
  }
}

export const scheduleCalculatorService = new ScheduleCalculatorService();