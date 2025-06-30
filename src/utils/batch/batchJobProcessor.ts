
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
    console.log(`🔄 Completing batch processing for batch ${batchId}`);

    // Get all batch job references for this batch
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
      // Fall back to unified batch processor for legacy batches
      const success = await completeBatchForProductionJobs(batchId, nextStageId);
      
      if (success) {
        toast.success("Batch processing completed successfully");
      }
      
      return success;
    }

    // Process each job using the integration service
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
    
  } catch (error) {
    console.error('❌ Error completing batch processing:', error);
    toast.error("Failed to complete batch processing");
    return false;
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
