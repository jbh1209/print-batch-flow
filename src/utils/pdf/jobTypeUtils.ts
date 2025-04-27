
import { Job } from "@/components/business-cards/JobsTable";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { BaseJob } from "@/config/productTypes";

export function isBusinessCardJobs(jobs: Job[] | FlyerJob[] | BaseJob[]): jobs is Job[] {
  if (jobs.length === 0) return false;
  return 'double_sided' in jobs[0];
}

export function isFlyerJobs(jobs: Job[] | FlyerJob[] | BaseJob[]): jobs is FlyerJob[] {
  if (jobs.length === 0) return false;
  return 'size' in jobs[0] && !('stock_type' in jobs[0]) && !('single_sided' in jobs[0]);
}

export function isSleeveJobs(jobs: Job[] | FlyerJob[] | BaseJob[]): jobs is BaseJob[] {
  if (jobs.length === 0) return false;
  return 'stock_type' in jobs[0] || 'single_sided' in jobs[0];
}
