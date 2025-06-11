
/**
 * SIMPLIFIED job completion utilities - Single Source of Truth
 * Uses ONLY production_jobs.status field for completion detection
 */

export interface SimpleJobLike {
  status?: string | null;
}

/**
 * SINGLE SOURCE OF TRUTH: Check if job is completed
 * Uses ONLY job.status = "Completed" (case sensitive)
 */
export const isJobCompleted = (job: SimpleJobLike): boolean => {
  if (!job) return false;
  return job.status === 'Completed';
};

/**
 * Check if job is in active production (has category and stages)
 */
export const isJobInProduction = (job: SimpleJobLike): boolean => {
  if (!job) return false;
  const status = job.status?.toLowerCase() || '';
  return ['production', 'printing', 'finishing', 'packaging'].includes(status);
};

/**
 * Check if job is pending (new, no category assigned)
 */
export const isJobPending = (job: SimpleJobLike): boolean => {
  if (!job) return false;
  const status = job.status?.toLowerCase() || '';
  return ['pre-press', 'pending'].includes(status) || !job.status;
};

/**
 * Get simplified job status for UI display
 */
export const getSimpleJobStatus = (job: SimpleJobLike): 'pending' | 'production' | 'completed' => {
  if (isJobCompleted(job)) return 'completed';
  if (isJobInProduction(job)) return 'production';
  return 'pending';
};

/**
 * Filter out completed jobs - for active job lists
 */
export const filterActiveJobs = <T extends SimpleJobLike>(jobs: T[]): T[] => {
  return jobs.filter(job => !isJobCompleted(job));
};

/**
 * Filter for only completed jobs - for completed job lists
 */
export const filterCompletedJobs = <T extends SimpleJobLike>(jobs: T[]): T[] => {
  return jobs.filter(job => isJobCompleted(job));
};
