
import { BaseJob } from "@/config/productTypes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { processProductionJobsForBatch, completeBatchForProductionJobs } from "./unifiedBatchProcessor";
import { createBatchJobFromProduction, completeBatchJobProcessing } from "./batchIntegrationService";

/**
 * Parameters for processing batch jobs
 */
interface ProcessBatchJobsParams {
  jobIds: string[];
  batchId: string;
  tableName: string;
}

/**
 * Result of batch job processing
 */
interface BatchJobsProcessResult {
  success: boolean;
  linkedCount: number;
  unlinkedCount: number;
}

/**
 * Links selected jobs to a batch - now uses enhanced batch processor
 */
export async function processBatchJobs({
  jobIds,
  batchId,
  tableName
}: ProcessBatchJobsParams): Promise<BatchJobsProcessResult> {
  console.log(`🔄 Processing ${jobIds.length} jobs for batch integration in table ${tableName}`);
  
  // Import and use the enhanced batch processor
  const { processBatchJobsEnhanced } = await import('./enhancedBatchProcessor');
  
  const result = await processBatchJobsEnhanced({
    jobIds,
    batchId,
    tableName
  });
  
  return {
    success: result.success,
    linkedCount: result.linkedCount,
    unlinkedCount: result.unlinkedCount
  };
}

/**
 * Complete batch processing and advance jobs back to main workflow
 */
export async function completeBatchProcessing(batchId: string, nextStageId?: string): Promise<boolean> {
  console.log(`🔄 Completing batch processing for batch ${batchId} - using enhanced processor`);
  
  // Import and use the enhanced batch processor
  const { completeBatchProcessingEnhanced } = await import('./enhancedBatchProcessor');
  
  const result = await completeBatchProcessingEnhanced(batchId, nextStageId);
  
  return result.success;
}

/**
 * Complete the Batch Allocation stage when jobs are successfully batched
 */
async function completeBatchAllocationStage(productionJobId: string, nextStageId?: string): Promise<void> {
  try {
    console.log(`🔄 Completing Batch Allocation stage for job ${productionJobId}`);

    // First, get the Batch Allocation stage ID
    const { data: batchStage, error: stageQueryError } = await supabase
      .from('production_stages')
      .select('id')
      .eq('name', 'Batch Allocation')
      .single();

    if (stageQueryError || !batchStage) {
      console.warn(`⚠️ Could not find Batch Allocation stage:`, stageQueryError);
      return;
    }

    // Complete the batch allocation stage instance
    const { error: stageError } = await supabase
      .from('job_stage_instances')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        notes: 'Job successfully batched and processed'
      })
      .eq('job_id', productionJobId)
      .eq('job_table_name', 'production_jobs')
      .in('status', ['active', 'pending'])
      .eq('production_stage_id', batchStage.id);

    if (stageError) {
      console.warn(`⚠️ Could not complete batch allocation stage for job ${productionJobId}:`, stageError);
    }

    // Activate next stage if specified
    if (nextStageId) {
      await supabase
        .from('job_stage_instances')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          notes: 'Advanced from batch allocation to next stage'
        })
        .eq('job_id', productionJobId)
        .eq('job_table_name', 'production_jobs')
        .eq('production_stage_id', nextStageId)
        .eq('status', 'pending');
    }

  } catch (error) {
    console.warn(`⚠️ Error completing batch allocation stage for job ${productionJobId}:`, error);
  }
}

/**
 * Get production job details for a batch job
 */
export async function getProductionJobForBatchJob(batchJobId: string, batchTableName: string) {
  try {
    const { data, error } = await supabase
      .from('batch_job_references')
      .select(`
        production_job_id,
        production_jobs (
          id,
          wo_no,
          customer,
          reference,
          qty,
          due_date,
          status,
          category_id,
          categories (
            name,
            color
          )
        )
      `)
      .eq('batch_job_id', batchJobId)
      .eq('batch_job_table', batchTableName)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error fetching production job for batch job:', error);
    return null;
  }
}
