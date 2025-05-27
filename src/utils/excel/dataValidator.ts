
import type { ParsedJob } from './types';

export const validateJobData = (job: ParsedJob): string[] => {
  const errors: string[] = [];
  
  // Only require essential fields - WO Number and Customer
  if (!job.wo_no) errors.push("Missing WO Number");
  if (!job.customer) errors.push("Missing Customer");
  
  // Due date is not required - can be blank
  // Quantity validation - allow 0 but warn if negative
  if (job.qty < 0) errors.push("Invalid Quantity (negative)");
  
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
