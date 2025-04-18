
import { Job } from "@/components/business-cards/JobsTable";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";

export function isBusinessCardJobs(jobs: Job[] | FlyerJob[]): jobs is Job[] {
  return jobs.length > 0 && 'double_sided' in jobs[0];
}
