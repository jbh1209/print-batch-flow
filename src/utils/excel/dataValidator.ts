
import type { ParsedJob } from './types';

export const validateJobData = (job: ParsedJob): string[] => {
  const errors: string[] = [];
  
  if (!job.wo_no) errors.push("Missing WO Number");
  if (!job.customer) errors.push("Missing Customer");
  if (!job.due_date) errors.push("Missing Due Date");
  if (job.qty <= 0) errors.push("Invalid Quantity");
  
  return errors;
};

export const validateAllJobs = (jobs: ParsedJob[]): string[] => {
  const validationErrors: string[] = [];
  
  jobs.forEach((job, index) => {
    const jobErrors = validateJobData(job);
    if (jobErrors.length > 0) {
      validationErrors.push(`Row ${index + 1}: ${jobErrors.join(', ')}`);
    }
  });
  
  return validationErrors;
};
