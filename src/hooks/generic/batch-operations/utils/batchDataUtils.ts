
import { BaseJob } from "@/config/productTypes";
import { LaminationType } from "@/config/types/productConfigTypes";
import { BatchData } from "../types/batchCreationTypes";
import { generateBatchName } from "@/utils/batch/batchNameGenerator";

/**
 * Calculates sheets required based on jobs
 */
export function calculateSheetsRequired(selectedJobs: BaseJob[]): number {
  // Default calculation - can be overridden for specific product types
  const totalItems = selectedJobs.reduce((sum, job) => sum + (job.quantity || 1), 0);
  const itemsPerSheet = 24; // Default value - business cards standard
  return Math.ceil(totalItems / itemsPerSheet);
}

/**
 * Finds the earliest due date among jobs
 */
export function findEarliestDueDate(jobs: BaseJob[]): Date {
  return jobs.reduce((earliest, job) => {
    const jobDate = new Date(job.due_date);
    return jobDate < earliest ? jobDate : earliest;
  }, new Date(jobs[0].due_date));
}

/**
 * Extracts common properties from jobs
 */
export function extractCommonJobProperties(
  job: BaseJob,
  config: any
): { paperType: string | undefined } {
  return {
    paperType: job.paper_type || config.paperType
  };
}

/**
 * Creates batch data object ready for DB insertion
 */
export async function prepareBatchData(
  selectedJobs: BaseJob[],
  userId: string,
  productType: string,
  laminationType: LaminationType,
  slaTarget: number,
  pdfUrls: { overviewUrl: string | null, impositionUrl: string | null }
): Promise<BatchData> {
  const sheetsRequired = calculateSheetsRequired(selectedJobs);
  const earliestDueDate = findEarliestDueDate(selectedJobs);
  const batchName = await generateBatchName(productType);
  const firstJob = selectedJobs[0];
  const { paperType } = extractCommonJobProperties(firstJob, {});
  
  return {
    name: batchName,
    sheets_required: sheetsRequired,
    due_date: earliestDueDate.toISOString(),
    lamination_type: laminationType,
    paper_type: paperType,
    status: 'pending' as const,
    created_by: userId,
    sla_target_days: slaTarget,
    front_pdf_url: pdfUrls.impositionUrl || null,
    back_pdf_url: pdfUrls.overviewUrl || null
  };
}
