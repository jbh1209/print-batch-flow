
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
 * Links selected jobs to a batch - updated to use unified workflow for production jobs
 */
export async function processBatchJobs({
  jobIds,
  batchId,
  tableName
}: ProcessBatchJobsParams): Promise<BatchJobsProcessResult> {
  if (jobIds.length === 0) {
    return { 
      success: false,
      linkedCount: 0,
      unlinkedCount: 0
    };
  }
  
  console.log(`Processing ${jobIds.length} jobs for batch integration in table ${tableName}`);
  
  // For production jobs, use the unified batch processor
  if (tableName === 'production_jobs') {
    try {
      const result = await processProductionJobsForBatch({
        productionJobIds: jobIds,
        batchId,
        batchType: 'mixed' // You might want to determine this based on batch category
      });

      return {
        success: result.success,
        linkedCount: result.processedCount,
        unlinkedCount: result.failedCount
      };
    } catch (error) {
      console.error('❌ Error processing production jobs for batch:', error);
      return {
        success: false,
        linkedCount: 0,
        unlinkedCount: jobIds.length
      };
    }
  } else {
    // For other job types, use the original logic (legacy batch system)
    try {
      const { error: updateError } = await supabase
        .from(tableName as any)
        .update({
          status: "batched",
          batch_id: batchId
        })
        .in("id", jobIds);
      
      if (updateError) {
        console.error("Error updating jobs with batch ID:", updateError);
        throw new Error(`Failed to link jobs to batch: ${updateError.message}`);
      }

      console.log(`All ${jobIds.length} jobs successfully linked to batch`);
      
      return {
        success: true,
        linkedCount: jobIds.length,
        unlinkedCount: 0
      };
    } catch (error) {
      console.error('❌ Error processing legacy batch jobs:', error);
      return {
        success: false,
        linkedCount: 0,
        unlinkedCount: jobIds.length
      };
    }
  }
}

/**
 * Complete batch processing and advance jobs back to main workflow
 */
export async function completeBatchProcessing(batchId: string, nextStageId?: string): Promise<boolean> {
  try {
    console.log(`🔄 Completing batch processing for batch ${batchId} - routing to enhanced service`);
    
    // Import and use the enhanced completion service
    const { completeBatchProcessingEnhanced } = await import('./batchCompletionService');
    const result = await completeBatchProcessingEnhanced(batchId, nextStageId);
    
    return result.success;
    
  } catch (error) {
    console.error('❌ Error in completeBatchProcessing:', error);
    
    // Fallback to original logic if enhanced service fails
    console.log('🔄 Falling back to original batch completion logic');
    
    // Original completion logic as fallback
    const { data: batchRefs, error: fetchError } = await supabase
      .from('batch_job_references')
      .select('production_job_id, batch_job_id, batch_job_table')
      .eq('batch_id', batchId)
      .eq('status', 'processing');

    if (fetchError) {
      console.error('❌ Error fetching batch references:', fetchError);
      throw fetchError;
    }

    if (!batchRefs || batchRefs.length === 0) {
      const success = await completeBatchForProductionJobs(batchId, nextStageId);
      
      if (success) {
        toast.success("Batch processing completed successfully");
      }
      
      return success;
    }

    let successCount = 0;
    for (const ref of batchRefs) {
      try {
        const success = await completeBatchJobProcessing(
          ref.production_job_id,
          ref.batch_job_id,
          nextStageId
        );
        
        if (success) {
          successCount++;
          await completeBatchAllocationStage(ref.production_job_id, nextStageId);
        }
      } catch (error) {
        console.error(`❌ Error completing job ${ref.production_job_id}:`, error);
      }
    }

    const allSuccessful = successCount === batchRefs.length;
    
    if (allSuccessful) {
      toast.success("Batch processing completed successfully");
    } else {
      toast.warning(`Completed ${successCount}/${batchRefs.length} jobs`);
    }
    
    return allSuccessful;
  }
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
