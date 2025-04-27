
import { Job } from "@/components/business-cards/JobsTable";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { BaseJob } from "@/config/productTypes";

// Update the function to handle BaseJob[] as well
export function isBusinessCardJobs(jobs: Job[] | FlyerJob[] | BaseJob[]): jobs is Job[] {
  // Check if array is empty
  if (jobs.length === 0) return false;
  
  // Check if the first job has the 'double_sided' property, which is specific to business cards
  return 'double_sided' in jobs[0];
}
