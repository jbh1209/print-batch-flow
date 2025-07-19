
import type { ParsedJob } from './types';

export const validateJobData = (job: ParsedJob): string[] => {
  const errors: string[] = [];
  
  // Only require essential fields - WO Number and Customer
  if (!job.wo_no) errors.push("Missing WO Number");
  if (!job.customer) errors.push("Missing Customer");
  
  // Quantity validation - allow 0 but warn if negative
  if (job.qty < 0) errors.push("Invalid Quantity (negative)");
  
  // Timing validation
  if (job.estimated_hours !== null && job.estimated_hours !== undefined) {
    if (job.estimated_hours < 0) errors.push("Invalid Estimated Hours (negative)");
    if (job.estimated_hours > 240) errors.push("Invalid Estimated Hours (too high)");
  }
  
  if (job.setup_time_minutes !== null && job.setup_time_minutes !== undefined) {
    if (job.setup_time_minutes < 0) errors.push("Invalid Setup Time (negative)");
    if (job.setup_time_minutes > 480) errors.push("Invalid Setup Time (too high)");
  }
  
  if (job.running_speed !== null && job.running_speed !== undefined) {
    if (job.running_speed <= 0) errors.push("Invalid Running Speed (must be positive)");
  }
  
  // Speed unit validation
  if (job.speed_unit && !['sheets_per_hour', 'items_per_hour', 'minutes_per_item'].includes(job.speed_unit)) {
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
