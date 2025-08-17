import { supabase } from "@/integrations/supabase/client";

export interface JobScheduleInfo {
  id: string;
  job_id: string;
  production_stage_id: string;
  stage_name: string;
  estimated_duration_minutes: number;
  created_at: string;
  status: string;
  wo_no?: string;
}

export interface ScheduledJob {
  original_instance_id: string;
  job_id: string;
  production_stage_id: string;
  stage_name: string;
  wo_no?: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  scheduled_minutes: number;
  is_split_job: boolean;
  split_job_part: number;
  split_job_total_parts: number;
  container_day: string;
  remaining_minutes?: number;
}

export interface StageScheduleResult {
  stage_id: string;
  stage_name: string;
  total_jobs: number;
  total_minutes: number;
  scheduled_jobs: ScheduledJob[];
  split_jobs_count: number;
  container_days_used: number;
}

export interface ScheduleResults {
  total_stages_processed: number;
  total_jobs_scheduled: number;
  total_split_jobs: number;
  stages: StageScheduleResult[];
  scheduling_start_date: string;
}

export class UniversalContainerScheduler {
  private readonly CONTAINER_CAPACITY_MINUTES = 480; // 8 hours * 60 minutes
  private readonly WORK_START_HOUR = 8; // 8:00 AM
  private readonly WORKING_DAYS = [1, 2, 3, 4, 5]; // Monday to Friday
  
  /**
   * Base scheduling date - Monday, 18-08-2025 at 8:00 AM UTC
   */
  private readonly BASE_SCHEDULE_DATE = new Date('2025-08-18T08:00:00.000Z');

  /**
   * Get all active/pending jobs across all stages
   */
  async getAllActiveJobs(): Promise<JobScheduleInfo[]> {
    const { data: jobs, error } = await supabase
      .from('job_stage_instances')
      .select(`
        id,
        job_id,
        production_stage_id,
        estimated_duration_minutes,
        created_at,
        status,
        production_stages!inner(name),
        production_jobs!inner(wo_no)
      `)
      .in('status', ['active', 'pending'])
      .not('estimated_duration_minutes', 'is', null)
      .order('created_at');

    if (error) {
      console.error('Error fetching active jobs:', error);
      throw error;
    }

    return (jobs || []).map(job => ({
      id: job.id,
      job_id: job.job_id,
      production_stage_id: job.production_stage_id,
      stage_name: (job as any).production_stages.name,
      estimated_duration_minutes: job.estimated_duration_minutes || 60,
      created_at: job.created_at,
      status: job.status,
      wo_no: (job as any).production_jobs?.wo_no
    }));
  }

  /**
   * Get the next working day date from a given date
   */
  private getNextWorkingDay(currentDate: Date): Date {
    const nextDay = new Date(currentDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    
    // If it's weekend (Saturday = 6, Sunday = 0), move to Monday
    const dayOfWeek = nextDay.getUTCDay();
    if (dayOfWeek === 6) { // Saturday
      nextDay.setUTCDate(nextDay.getUTCDate() + 2); // Move to Monday
    } else if (dayOfWeek === 0) { // Sunday
      nextDay.setUTCDate(nextDay.getUTCDate() + 1); // Move to Monday
    }
    
    // Set to 8:00 AM UTC
    nextDay.setUTCHours(this.WORK_START_HOUR, 0, 0, 0);
    return nextDay;
  }

  /**
   * Schedule jobs within daily containers for a specific stage
   */
  private scheduleJobsForStage(jobs: JobScheduleInfo[]): ScheduledJob[] {
    const scheduledJobs: ScheduledJob[] = [];
    let currentContainerDate = new Date(this.BASE_SCHEDULE_DATE);
    let currentContainerUsedMinutes = 0;

    for (const job of jobs) {
      let remainingMinutes = job.estimated_duration_minutes;
      let partNumber = 1;
      let totalParts = 1;

      // Check if job needs to be split
      if (remainingMinutes > this.CONTAINER_CAPACITY_MINUTES) {
        totalParts = Math.ceil(remainingMinutes / this.CONTAINER_CAPACITY_MINUTES);
      }

      while (remainingMinutes > 0) {
        const availableMinutes = this.CONTAINER_CAPACITY_MINUTES - currentContainerUsedMinutes;
        
        // If current container can't fit any part of the job, move to next container
        if (availableMinutes <= 0) {
          currentContainerDate = this.getNextWorkingDay(currentContainerDate);
          currentContainerUsedMinutes = 0;
          continue;
        }

        // Calculate how much of the job fits in current container
        const jobPartMinutes = Math.min(remainingMinutes, availableMinutes);
        
        // Calculate start and end times for this job part
        const startTime = new Date(currentContainerDate.getTime() + (currentContainerUsedMinutes * 60 * 1000));
        const endTime = new Date(startTime.getTime() + (jobPartMinutes * 60 * 1000));

        // Create scheduled job entry
        const scheduledJob: ScheduledJob = {
          original_instance_id: job.id,
          job_id: job.job_id,
          production_stage_id: job.production_stage_id,
          stage_name: job.stage_name,
          wo_no: job.wo_no,
          scheduled_start_at: startTime.toISOString(),
          scheduled_end_at: endTime.toISOString(),
          scheduled_minutes: jobPartMinutes,
          is_split_job: totalParts > 1,
          split_job_part: partNumber,
          split_job_total_parts: totalParts,
          container_day: currentContainerDate.toISOString().split('T')[0],
          remaining_minutes: remainingMinutes - jobPartMinutes
        };

        scheduledJobs.push(scheduledJob);

        // Update container usage
        currentContainerUsedMinutes += jobPartMinutes;
        remainingMinutes -= jobPartMinutes;
        partNumber++;

        // If container is full, move to next container
        if (currentContainerUsedMinutes >= this.CONTAINER_CAPACITY_MINUTES) {
          currentContainerDate = this.getNextWorkingDay(currentContainerDate);
          currentContainerUsedMinutes = 0;
        }
      }
    }

    return scheduledJobs;
  }

  /**
   * Group jobs by production stage
   */
  private groupJobsByStage(jobs: JobScheduleInfo[]): Map<string, JobScheduleInfo[]> {
    const stageJobsMap = new Map<string, JobScheduleInfo[]>();

    for (const job of jobs) {
      const stageKey = job.production_stage_id;
      if (!stageJobsMap.has(stageKey)) {
        stageJobsMap.set(stageKey, []);
      }
      stageJobsMap.get(stageKey)!.push(job);
    }

    // Sort jobs within each stage by created_at (approval date)
    stageJobsMap.forEach((stageJobs) => {
      stageJobs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });

    return stageJobsMap;
  }

  /**
   * Schedule all active jobs across all stages
   */
  async scheduleAllJobs(): Promise<ScheduleResults> {
    console.log('🚀 Universal Container Scheduler: Starting scheduling for all stages...');
    
    // Get all active jobs
    const allJobs = await this.getAllActiveJobs();
    console.log(`📊 Found ${allJobs.length} active/pending jobs across all stages`);

    // Group jobs by stage
    const stageJobsMap = this.groupJobsByStage(allJobs);
    console.log(`🏭 Processing ${stageJobsMap.size} stages`);

    const stageResults: StageScheduleResult[] = [];
    let totalJobsScheduled = 0;
    let totalSplitJobs = 0;

    // Process each stage independently
    for (const [stageId, stageJobs] of stageJobsMap) {
      const stageName = stageJobs[0]?.stage_name || 'Unknown Stage';
      console.log(`⚙️ Scheduling ${stageJobs.length} jobs for stage: ${stageName}`);

      const scheduledJobs = this.scheduleJobsForStage(stageJobs);
      const splitJobsCount = scheduledJobs.filter(job => job.is_split_job).length;
      const totalMinutes = scheduledJobs.reduce((sum, job) => sum + job.scheduled_minutes, 0);
      
      // Calculate how many container days were used
      const uniqueDays = new Set(scheduledJobs.map(job => job.container_day));
      const containerDaysUsed = uniqueDays.size;

      stageResults.push({
        stage_id: stageId,
        stage_name: stageName,
        total_jobs: stageJobs.length,
        total_minutes: totalMinutes,
        scheduled_jobs: scheduledJobs,
        split_jobs_count: splitJobsCount,
        container_days_used: containerDaysUsed
      });

      totalJobsScheduled += stageJobs.length;
      totalSplitJobs += splitJobsCount;

      console.log(`✅ Stage ${stageName}: ${stageJobs.length} jobs, ${splitJobsCount} split jobs, ${containerDaysUsed} days`);
    }

    const results: ScheduleResults = {
      total_stages_processed: stageJobsMap.size,
      total_jobs_scheduled: totalJobsScheduled,
      total_split_jobs: totalSplitJobs,
      stages: stageResults,
      scheduling_start_date: this.BASE_SCHEDULE_DATE.toISOString()
    };

    console.log('🎯 Universal scheduling complete:', results);
    return results;
  }
}

export const universalContainerScheduler = new UniversalContainerScheduler();