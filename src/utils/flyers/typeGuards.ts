
import { FlyerJob, FlyerBatch } from '@/components/batches/types/FlyerTypes';
import { Job, BatchDetailsType } from '@/components/batches/types/BatchTypes';
import { BaseJob } from '@/config/productTypes';

// Type guard for FlyerJob
export function isValidFlyerJob(obj: any): obj is FlyerJob {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.quantity === 'number' &&
    typeof obj.due_date === 'string' &&
    typeof obj.status === 'string' &&
    typeof obj.pdf_url === 'string'
  );
}

// Type guard for FlyerBatch
export function isValidFlyerBatch(obj: any): obj is FlyerBatch {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.status === 'string' &&
    typeof obj.due_date === 'string' &&
    typeof obj.created_at === 'string'
  );
}

// Safe converter from FlyerJob to Job
export function convertFlyerJobToJob(flyerJob: FlyerJob): Job {
  try {
    return {
      id: flyerJob.id,
      name: flyerJob.name,
      file_name: flyerJob.file_name || flyerJob.name || "",
      quantity: flyerJob.quantity,
      lamination_type: "none",
      due_date: flyerJob.due_date,
      uploaded_at: flyerJob.created_at,
      status: flyerJob.status as any, // Cast to allow flexible status types
      pdf_url: flyerJob.pdf_url,
      user_id: flyerJob.user_id || "",
      updated_at: flyerJob.updated_at || "",
      job_number: flyerJob.job_number || flyerJob.name || ""
    };
  } catch (error) {
    console.error('Error converting FlyerJob to Job:', error);
    throw new Error(`Failed to convert job ${flyerJob.id}`);
  }
}

// Safe converter from FlyerJob to BaseJob
export function convertFlyerJobToBaseJob(flyerJob: FlyerJob): BaseJob {
  try {
    return {
      id: flyerJob.id,
      name: flyerJob.name,
      quantity: flyerJob.quantity,
      due_date: flyerJob.due_date,
      status: flyerJob.status,
      pdf_url: flyerJob.pdf_url,
      user_id: flyerJob.user_id,
      created_at: flyerJob.created_at,
      updated_at: flyerJob.updated_at,
      batch_id: flyerJob.batch_id,
      file_name: flyerJob.file_name,
      job_number: flyerJob.job_number,
      // Specifications will be loaded separately via useJobSpecificationDisplay
      paper_type: 'N/A',
      paper_weight: 'N/A',
      size: 'N/A'
    };
  } catch (error) {
    console.error('Error converting FlyerJob to BaseJob:', error);
    throw new Error(`Failed to convert job ${flyerJob.id} to BaseJob`);
  }
}

// Safe converter from FlyerBatch to BatchDetailsType
export function convertFlyerBatchToBatchDetails(flyerBatch: FlyerBatch): BatchDetailsType {
  try {
    return {
      id: flyerBatch.id,
      name: flyerBatch.name,
      lamination_type: flyerBatch.lamination_type as any, // Cast to handle string to enum conversion
      sheets_required: flyerBatch.sheets_required,
      front_pdf_url: flyerBatch.front_pdf_url,
      back_pdf_url: flyerBatch.back_pdf_url,
      overview_pdf_url: flyerBatch.overview_pdf_url || flyerBatch.back_pdf_url,
      due_date: flyerBatch.due_date,
      created_at: flyerBatch.created_at,
      status: flyerBatch.status as any // Cast to allow flexible status types
    };
  } catch (error) {
    console.error('Error converting FlyerBatch to BatchDetailsType:', error);
    throw new Error(`Failed to convert batch ${flyerBatch.id}`);
  }
}

// Safe batch converter for arrays
export function convertFlyerJobsToJobs(flyerJobs: FlyerJob[]): Job[] {
  return flyerJobs
    .filter(isValidFlyerJob)
    .map(job => {
      try {
        return convertFlyerJobToJob(job);
      } catch (error) {
        console.error(`Skipping invalid job ${job.id}:`, error);
        return null;
      }
    })
    .filter((job): job is Job => job !== null);
}

// Safe batch converter for BaseJob arrays
export function convertFlyerJobsToBaseJobs(flyerJobs: FlyerJob[]): BaseJob[] {
  return flyerJobs
    .filter(isValidFlyerJob)
    .map(job => {
      try {
        return convertFlyerJobToBaseJob(job);
      } catch (error) {
        console.error(`Skipping invalid job ${job.id}:`, error);
        return null;
      }
    })
    .filter((job): job is BaseJob => job !== null);
}
