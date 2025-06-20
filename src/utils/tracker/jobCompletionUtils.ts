
/**
 * SIMPLIFIED job completion detection utilities
 * Single source of truth: job.status field with proper case handling
 */

export interface JobLike {
  status?: string | null;
  current_stage_status?: string | null;
  workflow_progress?: number;
}

/**
 * SIMPLE: Check if job is completed based ONLY on job status
 * This is the single source of truth for completion status
 * ONLY checks for exact match: "Completed"
 */
export const isJobCompleted = (job: JobLike): boolean => {
  if (!job) return false;
  
  // Simple check: completed jobs have status = "Completed" (exact match)
  return job.status === 'Completed';
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
