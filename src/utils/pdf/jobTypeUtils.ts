
import { Job, LaminationType } from "@/components/batches/types/BatchTypes";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { BaseJob } from "@/config/productTypes";

export function isBusinessCardJobs(jobs: Job[] | FlyerJob[] | BaseJob[]): jobs is Job[] {
  if (jobs.length === 0) return false;
  
  // Check for presence of business card properties 
  // Also check job structure to ensure it's a Job type
  const firstJob = jobs[0];
  return 'job_number' in firstJob && 
         ('double_sided' in firstJob || 'lamination_type' in firstJob) && 
         // Ensure it's not a FlyerJob (which might have some overlapping properties)
         !('size' in firstJob && typeof firstJob.size !== 'string');
}

export function isFlyerJobs(jobs: Job[] | FlyerJob[] | BaseJob[]): jobs is FlyerJob[] {
  if (jobs.length === 0) return false;
  
  const firstJob = jobs[0];
  return 'size' in firstJob && 
         typeof firstJob.size !== 'string' && // FlyerJob.size is an enum, not a string
         !('stock_type' in firstJob) && 
         !('single_sided' in firstJob);
}

export function isSleeveJobs(jobs: Job[] | FlyerJob[] | BaseJob[]): jobs is BaseJob[] {
  if (jobs.length === 0) return false;
  
  const firstJob = jobs[0];
  return 'stock_type' in firstJob || 'single_sided' in firstJob;
}
