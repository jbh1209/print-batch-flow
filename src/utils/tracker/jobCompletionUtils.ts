
/**
 * Standardized job completion detection utilities
 * This ensures consistent completion status checking across the entire application
 */

export interface JobLike {
  status?: string | null;
  current_stage_status?: string | null;
  workflow_progress?: number;
}

/**
 * Determines if a job is completed based on all possible completion indicators
 * This is the single source of truth for completion status
 */
export const isJobCompleted = (job: JobLike): boolean => {
  if (!job) return false;

  const status = job.status?.toLowerCase() || '';
  const stageStatus = job.current_stage_status?.toLowerCase() || '';

  // Check primary status field for completion indicators
  const completionStatuses = [
    'completed', 
    'shipped', 
    'delivered', 
    'cancelled', 
    'finished',
    'done',
    'complete'
  ];

  // Check if main status indicates completion
  if (completionStatuses.some(completedStatus => status.includes(completedStatus))) {
    return true;
  }

  // Check if current stage status indicates completion
  if (completionStatuses.some(completedStatus => stageStatus.includes(completedStatus))) {
    return true;
  }

  // Check workflow progress for 100% completion
  if (job.workflow_progress === 100) {
    return true;
  }

  return false;
};

/**
 * Filters out completed jobs from an array
 */
export const filterActiveJobs = <T extends JobLike>(jobs: T[]): T[] => {
  return jobs.filter(job => !isJobCompleted(job));
};

/**
 * Filters for only completed jobs from an array
 */
export const filterCompletedJobs = <T extends JobLike>(jobs: T[]): T[] => {
  return jobs.filter(job => isJobCompleted(job));
};

/**
 * Gets job counts with proper completion filtering
 */
export const getJobCounts = <T extends JobLike>(jobs: T[]) => {
  const activeJobs = filterActiveJobs(jobs);
  const completedJobs = filterCompletedJobs(jobs);

  return {
    total: jobs.length,
    active: activeJobs.length,
    completed: completedJobs.length,
    activeJobs,
    completedJobs
  };
};
