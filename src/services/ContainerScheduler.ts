export interface JobScheduleInfo {
  id: string;
  job_id: string;
  production_stage_id: string;
  stage_name: string;
  estimated_duration_minutes: number;
  created_at: string;
  status: string;
  stage_order: number;
}

export interface ScheduledJob {
  instance_id: string;
  job_id: string;
  production_stage_id: string;
  stage_name: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  scheduled_minutes: number;
  is_split_job: boolean;
  split_job_part: number;
  split_job_total_parts: number;
  container_day: string;
}

export interface ContainerScheduleResults {
  total_jobs_scheduled: number;
  total_split_jobs: number;
  containers_used: number;
  scheduling_start_date: string;
  scheduled_jobs: ScheduledJob[];
}

export class ContainerScheduler {
  private readonly CONTAINER_CAPACITY_MINUTES = 480; // 8 hours * 60 minutes
  private readonly WORK_START_HOUR = 8; // 8:00 AM
  private readonly BASE_SCHEDULE_DATE = new Date('2025-08-18T08:00:00.000Z'); // Monday start

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
   * Schedule jobs within daily containers
   */
  scheduleJobsIntoContainers(jobs: JobScheduleInfo[]): ScheduledJob[] {
    const scheduledJobs: ScheduledJob[] = [];
    let currentContainerDate = new Date(this.BASE_SCHEDULE_DATE);
    let currentContainerUsedMinutes = 0;

    // Sort jobs by created_at (approval date) for FIFO scheduling
    const sortedJobs = [...jobs].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    for (const job of sortedJobs) {
      let remainingMinutes = job.estimated_duration_minutes || 60; // Default 1 hour if null
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
          instance_id: job.id,
          job_id: job.job_id,
          production_stage_id: job.production_stage_id,
          stage_name: job.stage_name,
          scheduled_start_at: startTime.toISOString(),
          scheduled_end_at: endTime.toISOString(),
          scheduled_minutes: jobPartMinutes,
          is_split_job: totalParts > 1,
          split_job_part: partNumber,
          split_job_total_parts: totalParts,
          container_day: currentContainerDate.toISOString().split('T')[0]
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
   * Build container schedule results
   */
  buildScheduleResults(scheduledJobs: ScheduledJob[]): ContainerScheduleResults {
    const uniqueDays = new Set(scheduledJobs.map(job => job.container_day));
    const splitJobsCount = scheduledJobs.filter(job => job.is_split_job).length;

    return {
      total_jobs_scheduled: new Set(scheduledJobs.map(job => job.instance_id)).size,
      total_split_jobs: splitJobsCount,
      containers_used: uniqueDays.size,
      scheduling_start_date: this.BASE_SCHEDULE_DATE.toISOString(),
      scheduled_jobs: scheduledJobs
    };
  }
}

export const containerScheduler = new ContainerScheduler();