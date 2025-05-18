
import { BaseJob, BaseBatch, LaminationType, JobStatus, BatchStatus } from "@/config/types/baseTypes";
import { Job, BatchDetailsType } from "@/components/batches/types/BatchTypes";
import { safeBatchConversion, safeJobConversion } from "./typeSafety";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";

/**
 * Converts a BaseJob to a Job type with safety checks
 * @param baseJob The base job to convert
 * @returns A Job type with all required properties
 */
export const convertToJobType = (baseJob: BaseJob): Job => {
  const safeJob = safeJobConversion(baseJob);
  
  return {
    id: safeJob.id,
    name: safeJob.name,
    quantity: safeJob.quantity,
    status: safeJob.status,
    pdf_url: safeJob.pdf_url,
    job_number: safeJob.job_number,
    due_date: safeJob.due_date,
    file_name: safeJob.file_name,
    lamination_type: safeJob.lamination_type,
    user_id: safeJob.user_id,
    batch_id: safeJob.batch_id,
    created_at: safeJob.created_at,
    updated_at: safeJob.updated_at,
    size: safeJob.size,
    paper_type: safeJob.paper_type,
    paper_weight: safeJob.paper_weight,
    sides: safeJob.sides,
    stock_type: safeJob.stock_type
  };
};

/**
 * Converts an array of BaseJob to Job[] type with safety checks
 * @param baseJobs Array of base jobs to convert
 * @returns Array of Job types with all required properties
 */
export const convertToJobsArray = (baseJobs: BaseJob[]): Job[] => {
  return baseJobs.map(job => convertToJobType(job));
};

/**
 * Converts a BaseBatch to a BatchDetailsType with safety checks
 * @param batch The base batch to convert
 * @returns A BatchDetailsType with all required properties
 */
export const convertToBatchDetailsType = (batch: BaseBatch): BatchDetailsType => {
  const safeBatch = safeBatchConversion(batch);
  
  return {
    id: safeBatch.id,
    name: safeBatch.name,
    status: safeBatch.status,
    sheets_required: safeBatch.sheets_required,
    front_pdf_url: safeBatch.front_pdf_url,
    back_pdf_url: safeBatch.back_pdf_url,
    overview_pdf_url: safeBatch.overview_pdf_url,
    due_date: safeBatch.due_date,
    created_at: safeBatch.created_at,
    lamination_type: safeBatch.lamination_type,
    paper_type: safeBatch.paper_type,
    paper_weight: safeBatch.paper_weight,
    sides: safeBatch.sides,
    created_by: safeBatch.created_by,
    updated_at: safeBatch.updated_at,
    date_created: safeBatch.date_created,
    sheet_size: safeBatch.sheet_size,
    printer_type: safeBatch.printer_type
  };
};

/**
 * Ensures the database batch status is compatible with our BatchStatus type
 * @param status Status string from database
 * @returns A valid BatchStatus value
 */
export const ensureValidBatchStatus = (status: string): BatchStatus => {
  if (['pending', 'queued', 'processing', 'completed', 'sent_to_print', 'cancelled'].includes(status)) {
    return status as BatchStatus;
  }
  
  return 'queued';
};

/**
 * Converts a BaseJob to a FlyerJob with proper type safety
 * @param baseJob Base job to convert to a FlyerJob
 * @returns A properly typed FlyerJob
 */
export const convertToFlyerJob = (baseJob: BaseJob): FlyerJob => {
  return {
    id: baseJob.id,
    name: baseJob.name,
    job_number: baseJob.job_number,
    size: (baseJob.size as FlyerJob['size']) || 'A4',
    paper_weight: baseJob.paper_weight || '115gsm',
    paper_type: (baseJob.paper_type as FlyerJob['paper_type']) || 'Matt',
    quantity: baseJob.quantity,
    due_date: baseJob.due_date,
    batch_id: baseJob.batch_id,
    status: (baseJob.status as FlyerJob['status']) || 'queued',
    pdf_url: baseJob.pdf_url || '',
    file_name: baseJob.file_name,
    user_id: baseJob.user_id,
    created_at: baseJob.created_at,
    updated_at: baseJob.updated_at || baseJob.created_at
  };
};
