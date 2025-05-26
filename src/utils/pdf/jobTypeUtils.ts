
import { Job } from "@/components/business-cards/JobsTable";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { BaseJob } from "@/config/productTypes";

export function isBusinessCardJobs(jobs: Job[] | FlyerJob[] | BaseJob[]): jobs is Job[] {
  console.log("Checking if jobs are business card jobs - count:", jobs.length);
  if (jobs.length === 0) {
    console.log("No jobs provided");
    return false;
  }
  
  const firstJob = jobs[0];
  console.log("First job properties:", Object.keys(firstJob));
  console.log("Has double_sided:", 'double_sided' in firstJob);
  console.log("double_sided value:", firstJob.double_sided);
  
  const isBusinessCard = 'double_sided' in firstJob;
  console.log("Is business card jobs:", isBusinessCard);
  return isBusinessCard;
}

export function isFlyerJobs(jobs: Job[] | FlyerJob[] | BaseJob[]): jobs is FlyerJob[] {
  if (jobs.length === 0) return false;
  return 'size' in jobs[0] && !('stock_type' in jobs[0]) && !('single_sided' in jobs[0]);
}

export function isSleeveJobs(jobs: Job[] | FlyerJob[] | BaseJob[]): jobs is BaseJob[] {
  if (jobs.length === 0) return false;
  return 'stock_type' in jobs[0] || 'single_sided' in jobs[0];
}
