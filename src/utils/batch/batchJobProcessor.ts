
import { BaseJob } from "@/config/productTypes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { processProductionJobsForBatch, completeBatchForProductionJobs } from "./unifiedBatchProcessor";

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

    // Use the unified batch processor for production jobs
    const success = await completeBatchForProductionJobs(batchId, nextStageId);
    
    if (success) {
      toast.success("Batch processing completed successfully");
    }
    
    return success;
  } catch (error) {
    console.error('❌ Error completing batch processing:', error);
    toast.error("Failed to complete batch processing");
    return false;
  }
}
