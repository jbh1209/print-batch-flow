
import { BaseJob, ExistingTableName } from "@/config/productTypes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  verifyBatchJobLinks, 
  relinkJobs 
} from "@/utils/batch/batchVerificationUtils";
import { LinkedJobResult } from "@/hooks/generic/batch-operations/types/batchVerificationTypes";

/**
 * Parameters for processing batch jobs
 */
interface ProcessBatchJobsParams {
  jobIds: string[];
  batchId: string;
  tableName: ExistingTableName;
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
 * Links selected jobs to a batch and performs verification
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
  
  console.log(`Updating ${jobIds.length} jobs in table ${tableName} with batch id ${batchId}`);
  
  // Update the jobs with the batch ID
  const { error: updateError } = await supabase
    .from(tableName)
    .update({
      status: "batched",
      batch_id: batchId
    })
    .in("id", jobIds);
  
  if (updateError) {
    console.error("Error updating jobs with batch ID:", updateError);
    console.error("Error details:", updateError.details || updateError.hint || updateError.message);
    throw new Error(`Failed to link jobs to batch: ${updateError.message}`);
  }
  
  // Verify jobs were correctly updated with batch ID
  const verificationResult = await verifyBatchJobLinks({
    jobIds,
    batchId,
    tableName
  });
  
  // Handle unlinked jobs
  if (verificationResult.unlinkedJobs.length > 0) {
    console.warn(`Warning: ${verificationResult.unlinkedJobs.length} jobs not correctly linked to batch`);
    
    // Try to relink jobs that weren't properly linked
    const relinkResult = await relinkJobs(
      verificationResult.unlinkedJobs,
      batchId,
      tableName
    );
    
    // Perform a final check if we had any unlinked jobs that we attempted to fix
    if (relinkResult.failed > 0) {
      const stillUnlinkedIds = verificationResult.unlinkedJobs
        .map(job => job.id);
      
      if (stillUnlinkedIds.length > 0) {
        const finalCheckResult = await verifyBatchJobLinks({
          jobIds: stillUnlinkedIds,
          batchId,
          tableName
        });
        
        // If we still have unlinked jobs after retrying, show a warning
        const stillUnlinked = finalCheckResult.unlinkedJobs.length;
        if (stillUnlinked > 0) {
          toast.warning(`${stillUnlinked} jobs could not be linked to the batch`, {
            description: "Some jobs may need to be manually added to the batch"
          });
        }
      }
    }
  } else {
    console.log(`All ${verificationResult.linkedJobs.length} jobs successfully linked to batch ${batchId}`);
  }
  
  // Return the final result
  return {
    success: true,
    linkedCount: verificationResult.linkedJobs.length,
    unlinkedCount: verificationResult.unlinkedJobs.length - (verificationResult.unlinkedJobs.length > 0 ? 0 : 0)
  };
}
