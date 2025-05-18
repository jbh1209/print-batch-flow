
import { BaseJob, BaseBatch, BatchStatus, JobStatus, LaminationType } from "@/config/types/baseTypes";
import { Job, BatchDetailsType } from "@/components/batches/types/BatchTypes";

/**
 * Converts a BaseJob to a Job type
 */
export const convertToJobType = (baseJob: BaseJob): Job => {
  return {
    id: baseJob.id,
    name: baseJob.name || '',  // Ensure name is not undefined
    quantity: baseJob.quantity,
    status: baseJob.status as JobStatus | string, // Cast to JobStatus or string
    pdf_url: baseJob.pdf_url || null,
    job_number: baseJob.job_number || `JOB-${baseJob.id.substring(0, 6)}`, // Ensure job_number is always provided
    due_date: baseJob.due_date || new Date().toISOString(), // Ensure due_date is always provided
    file_name: baseJob.file_name || baseJob.name || '', // Ensure file_name is always provided
    lamination_type: (baseJob.lamination_type as LaminationType) || 'none', // Ensure lamination_type is always provided and cast to LaminationType
    user_id: baseJob.user_id // Include user_id
  };
};

/**
 * Converts an array of BaseJob to Job[] type
 */
export const convertToJobsArray = (baseJobs: BaseJob[]): Job[] => {
  return baseJobs.map(job => convertToJobType(job));
};

/**
 * Converts a BaseBatch to a BatchDetailsType
 */
export const convertToBatchDetailsType = (batch: BaseBatch): BatchDetailsType => {
  // Ensure lamination_type is properly cast to LaminationType
  const laminationType = batch.lamination_type as LaminationType;
  
  return {
    id: batch.id,
    name: batch.name,
    status: batch.status,
    sheets_required: batch.sheets_required,
    front_pdf_url: batch.front_pdf_url,
    back_pdf_url: batch.back_pdf_url,
    overview_pdf_url: batch.overview_pdf_url,
    due_date: batch.due_date,
    created_at: batch.created_at,
    lamination_type: laminationType,
    paper_type: batch.paper_type,
    paper_weight: batch.paper_weight,
    sides: batch.sides,
    created_by: batch.created_by,
    updated_at: batch.updated_at,
    date_created: batch.date_created,
    sheet_size: batch.sheet_size,
    printer_type: batch.printer_type
  };
};

/**
 * Ensures the database batch status is compatible with our BatchStatus type
 */
export const ensureValidBatchStatus = (status: string): BatchStatus => {
  // Check if the status is already a valid BatchStatus
  if (['pending', 'queued', 'processing', 'completed', 'sent_to_print', 'cancelled'].includes(status)) {
    return status as BatchStatus;
  }
  
  // Default to 'queued' if it's an invalid status
  return 'queued';
};
