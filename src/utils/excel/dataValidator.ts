
import type { ParsedJob } from './types';

export const validateJobData = (job: ParsedJob): string[] => {
  const errors: string[] = [];
  
  // Only require essential fields - WO Number and Customer
  if (!job.woNo) errors.push("Missing WO Number");
  if (!job.customer) errors.push("Missing Customer");
  
  // Quantity validation - allow 0 but warn if negative
  if (job.qty < 0) errors.push("Invalid Quantity (negative)");
  
  // Timing validation
  if (job.estimatedHours !== null && job.estimatedHours !== undefined) {
    if (job.estimatedHours < 0) errors.push("Invalid Estimated Hours (negative)");
    if (job.estimatedHours > 240) errors.push("Invalid Estimated Hours (too high)");
  }
  
  if (job.setupTime !== null && job.setupTime !== undefined) {
    if (job.setupTime < 0) errors.push("Invalid Setup Time (negative)");
    if (job.setupTime > 480) errors.push("Invalid Setup Time (too high)");
  }
  
  if (job.runningSpeed !== null && job.runningSpeed !== undefined) {
    if (job.runningSpeed <= 0) errors.push("Invalid Running Speed (must be positive)");
  }
  
  // Speed unit validation
  if (job.speedUnit && !['sheets_per_hour', 'items_per_hour', 'minutes_per_item'].includes(job.speedUnit)) {
    errors.push("Invalid Speed Unit (must be sheets_per_hour, items_per_hour, or minutes_per_item)");
  }
  
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
