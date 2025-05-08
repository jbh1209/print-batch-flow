
import { BaseBatch, BatchStatus, BaseJob } from "@/config/types/baseTypes";
import { Job } from "@/components/business-cards/JobsTable";
import { castToUUID, toSafeString, safeNumber, safeBoolean } from "./dbHelpers";

/**
 * Type adapter functions for safely converting between database and application types
 */

/**
 * Adapts user profile data from database response
 */
export const adaptUserProfile = (dbProfile: any): any => {
  if (!dbProfile || typeof dbProfile !== 'object') return null;
  if ('error' in dbProfile) return null;

  return {
    id: toSafeString(dbProfile.id),
    full_name: dbProfile.full_name ? toSafeString(dbProfile.full_name) : undefined,
    avatar_url: dbProfile.avatar_url ? toSafeString(dbProfile.avatar_url) : undefined,
    created_at: dbProfile.created_at ? toSafeString(dbProfile.created_at) : undefined,
    updated_at: dbProfile.updated_at ? toSafeString(dbProfile.updated_at) : undefined,
  };
};

/**
 * Adapts batch object from DB to application BaseBatch type
 */
export const adaptBatchFromDb = <T extends BaseBatch>(dbBatch: any): T | null => {
  if (!dbBatch || typeof dbBatch !== 'object') return null;
  if ('error' in dbBatch) return null;

  return {
    id: toSafeString(dbBatch.id),
    name: toSafeString(dbBatch.name),
    status: (toSafeString(dbBatch.status) || 'pending') as BatchStatus,
    sheets_required: safeNumber(dbBatch.sheets_required, 0),
    front_pdf_url: dbBatch.front_pdf_url ? toSafeString(dbBatch.front_pdf_url) : null,
    back_pdf_url: dbBatch.back_pdf_url ? toSafeString(dbBatch.back_pdf_url) : null,
    overview_pdf_url: dbBatch.overview_pdf_url ? toSafeString(dbBatch.overview_pdf_url) : null,
    due_date: toSafeString(dbBatch.due_date),
    created_at: toSafeString(dbBatch.created_at),
    lamination_type: toSafeString(dbBatch.lamination_type || 'none'),
    paper_type: dbBatch.paper_type ? toSafeString(dbBatch.paper_type) : undefined,
    paper_weight: dbBatch.paper_weight ? toSafeString(dbBatch.paper_weight) : undefined,
    created_by: dbBatch.created_by ? toSafeString(dbBatch.created_by) : undefined,
    updated_at: dbBatch.updated_at ? toSafeString(dbBatch.updated_at) : undefined,
    sheet_size: dbBatch.sheet_size ? toSafeString(dbBatch.sheet_size) : undefined,
    printer_type: dbBatch.printer_type ? toSafeString(dbBatch.printer_type) : undefined,
  } as T;
};

/**
 * Adapts job object from DB to application Job type
 */
export const adaptJobFromDb = <T extends BaseJob>(dbJob: any): T | null => {
  if (!dbJob || typeof dbJob !== 'object') return null;
  if ('error' in dbJob) return null;

  // Convert to BaseJob format
  const baseJob: Record<string, any> = {
    id: toSafeString(dbJob.id),
    name: toSafeString(dbJob.name),
    status: toSafeString(dbJob.status),
    quantity: safeNumber(dbJob.quantity),
    due_date: toSafeString(dbJob.due_date),
    created_at: toSafeString(dbJob.created_at),
    updated_at: toSafeString(dbJob.updated_at),
    batch_id: dbJob.batch_id ? toSafeString(dbJob.batch_id) : null,
  };

  // Add optional fields if they exist
  if ('pdf_url' in dbJob) baseJob.pdf_url = dbJob.pdf_url ? toSafeString(dbJob.pdf_url) : undefined;
  if ('file_name' in dbJob) baseJob.file_name = dbJob.file_name ? toSafeString(dbJob.file_name) : undefined;
  if ('lamination_type' in dbJob) baseJob.lamination_type = toSafeString(dbJob.lamination_type);
  if ('paper_type' in dbJob) baseJob.paper_type = toSafeString(dbJob.paper_type);
  if ('paper_weight' in dbJob) baseJob.paper_weight = toSafeString(dbJob.paper_weight);
  if ('job_number' in dbJob) baseJob.job_number = toSafeString(dbJob.job_number);
  if ('size' in dbJob) baseJob.size = toSafeString(dbJob.size);
  if ('sides' in dbJob) baseJob.sides = toSafeString(dbJob.sides);
  if ('stock_type' in dbJob) baseJob.stock_type = toSafeString(dbJob.stock_type);
  if ('single_sided' in dbJob) baseJob.single_sided = safeBoolean(dbJob.single_sided);
  if ('double_sided' in dbJob) baseJob.double_sided = safeBoolean(dbJob.double_sided);
  if ('uv_varnish' in dbJob) baseJob.uv_varnish = toSafeString(dbJob.uv_varnish);

  return baseJob as T;
};

/**
 * Adapts an array of database job objects to application Job type
 */
export const adaptJobArrayFromDb = <T extends BaseJob>(dbJobs: any[] | null): T[] => {
  if (!dbJobs || !Array.isArray(dbJobs)) return [];
  
  return dbJobs
    .map(job => adaptJobFromDb<T>(job))
    .filter((job): job is T => job !== null);
};

/**
 * Prepare batch data for insertion into database
 */
export const prepareBatchForDb = (batch: Partial<BaseBatch>): Record<string, any> => {
  const dbBatch: Record<string, any> = {};
  
  // Map properties safely
  if ('name' in batch && batch.name) dbBatch.name = batch.name;
  if ('status' in batch && batch.status) dbBatch.status = batch.status;
  if ('sheets_required' in batch && batch.sheets_required !== undefined) {
    dbBatch.sheets_required = batch.sheets_required;
  }
  if ('front_pdf_url' in batch) dbBatch.front_pdf_url = batch.front_pdf_url;
  if ('back_pdf_url' in batch) dbBatch.back_pdf_url = batch.back_pdf_url;
  if ('overview_pdf_url' in batch) dbBatch.overview_pdf_url = batch.overview_pdf_url;
  if ('due_date' in batch && batch.due_date) dbBatch.due_date = batch.due_date;
  if ('lamination_type' in batch && batch.lamination_type) dbBatch.lamination_type = batch.lamination_type;
  if ('paper_type' in batch) dbBatch.paper_type = batch.paper_type;
  if ('paper_weight' in batch) dbBatch.paper_weight = batch.paper_weight;
  if ('created_by' in batch && batch.created_by) dbBatch.created_by = castToUUID(batch.created_by);
  if ('sheet_size' in batch) dbBatch.sheet_size = batch.sheet_size;
  if ('printer_type' in batch) dbBatch.printer_type = batch.printer_type;
  
  return dbBatch;
};

/**
 * Prepare job data for insertion into database
 */
export const prepareJobForDb = (job: Partial<BaseJob>): Record<string, any> => {
  const dbJob: Record<string, any> = {};
  
  // Map properties safely
  if ('name' in job && job.name) dbJob.name = job.name;
  if ('quantity' in job && job.quantity !== undefined) dbJob.quantity = job.quantity;
  if ('status' in job && job.status) dbJob.status = job.status;
  if ('due_date' in job && job.due_date) dbJob.due_date = job.due_date;
  if ('batch_id' in job) dbJob.batch_id = job.batch_id ? castToUUID(job.batch_id) : null;
  if ('user_id' in job && job.user_id) dbJob.user_id = castToUUID(job.user_id);
  if ('pdf_url' in job) dbJob.pdf_url = job.pdf_url;
  if ('file_name' in job) dbJob.file_name = job.file_name;
  if ('lamination_type' in job) dbJob.lamination_type = job.lamination_type;
  if ('paper_type' in job) dbJob.paper_type = job.paper_type;
  if ('paper_weight' in job) dbJob.paper_weight = job.paper_weight;
  if ('job_number' in job) dbJob.job_number = job.job_number;
  if ('size' in job) dbJob.size = job.size;
  if ('sides' in job) dbJob.sides = job.sides;
  if ('stock_type' in job) dbJob.stock_type = job.stock_type;
  if ('single_sided' in job) dbJob.single_sided = job.single_sided;
  if ('double_sided' in job) dbJob.double_sided = job.double_sided;
  if ('uv_varnish' in job) dbJob.uv_varnish = job.uv_varnish;
  
  return dbJob;
};
