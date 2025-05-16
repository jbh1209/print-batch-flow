
import { Job } from "@/components/batches/types/BatchTypes";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { BaseJob } from "@/config/productTypes";

export function isBusinessCardJobs(jobs: Job[] | FlyerJob[] | BaseJob[]): jobs is Job[] {
  if (jobs.length === 0) return false;
  // Check for presence of business card properties 
  // Also check job structure to ensure it's a Job type
  return 'job_number' in jobs[0] && ('double_sided' in jobs[0] || 'lamination_type' in jobs[0]);
}

export function isFlyerJobs(jobs: Job[] | FlyerJob[] | BaseJob[]): jobs is FlyerJob[] {
  if (jobs.length === 0) return false;
  return 'size' in jobs[0] && !('stock_type' in jobs[0]) && !('single_sided' in jobs[0]);
}

export function isSleeveJobs(jobs: Job[] | FlyerJob[] | BaseJob[]): jobs is BaseJob[] {
  if (jobs.length === 0) return false;
  return 'stock_type' in jobs[0] || 'single_sided' in jobs[0];
}
