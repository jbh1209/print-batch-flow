
import { BaseJob, JobStatus, LaminationType, BaseBatch, BatchStatus } from "@/config/types/baseTypes";

/**
 * Type guard to check if a value is a valid JobStatus
 * @param status The status string to check
 * @returns True if the status is a valid JobStatus
 */
export function isValidJobStatus(status: string): status is JobStatus {
  return ['queued', 'batched', 'processing', 'completed', 'cancelled', 'sent_to_print'].includes(status);
}

/**
 * Type guard to check if a value is a valid BatchStatus
 * @param status The status string to check
 * @returns True if the status is a valid BatchStatus
 */
export function isValidBatchStatus(status: string): status is BatchStatus {
  return ['pending', 'queued', 'processing', 'sent_to_print', 'completed', 'cancelled'].includes(status);
}

/**
 * Type guard to check if a value is a valid LaminationType
 * @param lamination The lamination type string to check
 * @returns True if the lamination is a valid LaminationType
 */
export function isValidLaminationType(lamination: string): lamination is LaminationType {
  return ['gloss', 'matt', 'soft_touch', 'none'].includes(lamination);
}

/**
 * Ensures a string is a valid JobStatus, defaulting to 'queued' if not
 * @param status Status string to validate
 * @returns A valid JobStatus
 */
export function ensureJobStatus(status: string): JobStatus {
  return isValidJobStatus(status) ? status : 'queued';
}

/**
 * Ensures a string is a valid BatchStatus, defaulting to 'pending' if not
 * @param status Status string to validate
 * @returns A valid BatchStatus
 */
export function ensureBatchStatus(status: string): BatchStatus {
  return isValidBatchStatus(status) ? status : 'pending';
}

/**
 * Ensures a string is a valid LaminationType, defaulting to 'none' if not
 * @param lamination Lamination type string to validate
 * @returns A valid LaminationType
 */
export function ensureLaminationType(lamination: string): LaminationType {
  return isValidLaminationType(lamination) ? lamination : 'none';
}

/**
 * Safely converts a job to ensure all properties meet BaseJob requirements
 * @param job Object with job properties
 * @returns A valid BaseJob with all required properties
 */
export function safeJobConversion(job: any): BaseJob {
  return {
    id: job.id || '',
    name: job.name || '',
    job_number: job.job_number || '',
    status: ensureJobStatus(job.status),
    quantity: job.quantity || 0,
    due_date: job.due_date || new Date().toISOString(),
    created_at: job.created_at || new Date().toISOString(),
    updated_at: job.updated_at || new Date().toISOString(),
    batch_id: job.batch_id || null,
    user_id: job.user_id || '',
    pdf_url: job.pdf_url || null,
    file_name: job.file_name || '',
    lamination_type: ensureLaminationType(job.lamination_type),
    size: job.size || undefined,
    paper_type: job.paper_type || undefined,
    paper_weight: job.paper_weight || undefined,
    sides: job.sides || undefined,
    stock_type: job.stock_type || undefined
  };
}

/**
 * Safely converts a batch to ensure all properties meet BaseBatch requirements
 * @param batch Object with batch properties
 * @returns A valid BaseBatch with all required properties
 */
export function safeBatchConversion(batch: any): BaseBatch {
  return {
    id: batch.id || '',
    name: batch.name || '',
    status: ensureBatchStatus(batch.status),
    sheets_required: batch.sheets_required || 0,
    lamination_type: ensureLaminationType(batch.lamination_type),
    created_at: batch.created_at || new Date().toISOString(),
    due_date: batch.due_date || new Date().toISOString(),
    front_pdf_url: batch.front_pdf_url || null,
    back_pdf_url: batch.back_pdf_url || null,
    overview_pdf_url: batch.overview_pdf_url || null,
    created_by: batch.created_by || '',
    updated_at: batch.updated_at || batch.created_at || new Date().toISOString(),
    date_created: batch.date_created || batch.created_at || new Date().toISOString(),
    sheet_size: batch.sheet_size || undefined,
    printer_type: batch.printer_type || undefined,
    paper_type: batch.paper_type || undefined,
    paper_weight: batch.paper_weight || undefined,
    sides: batch.sides || undefined
  };
}
