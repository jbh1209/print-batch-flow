
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
 * Links selected jobs to a batch and performs verification - updated for workflow integration
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
  
  // For production jobs, we need to handle the workflow integration
  if (tableName === 'production_jobs') {
    for (const jobId of jobIds) {
      try {
        // Complete the batch allocation stage and advance to printing
        const { error: completeError } = await supabase
          .from('job_stage_instances')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            notes: `Batch allocation completed - assigned to batch ${batchId}`
          })
          .eq('job_id', jobId)
          .eq('job_table_name', tableName)
          .eq('status', 'active')
          .like('notes', '%batch allocation%');

        if (completeError) {
          console.error(`❌ Error completing batch allocation for job ${jobId}:`, completeError);
        }

        // Update the production job status
        const { error: jobUpdateError } = await supabase
          .from(tableName)
          .update({
            status: "In Batch Processing",
            batch_id: batchId,
            batch_ready: true,
            batch_allocated_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", jobId);

        if (jobUpdateError) {
          console.error(`❌ Error updating job ${jobId}:`, jobUpdateError);
          throw jobUpdateError;
        }

        console.log(`✅ Job ${jobId} successfully integrated into batch workflow`);
      } catch (error) {
        console.error(`❌ Error processing job ${jobId} for batch:`, error);
        // Continue with other jobs even if one fails
      }
    }
  } else {
    // For other job types, use the original logic
    const { error: updateError } = await supabase
      .from(tableName)
      .update({
        status: "batched",
        batch_id: batchId
      })
      .in("id", jobIds);
    
    if (updateError) {
      console.error("Error updating jobs with batch ID:", updateError);
      throw new Error(`Failed to link jobs to batch: ${updateError.message}`);
    }
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
    console.log(`All ${verificationResult.linkedJobs.length} jobs successfully integrated into batch workflow`);
  }
  
  // Return the final result
  return {
    success: true,
    linkedCount: verificationResult.linkedJobs.length,
    unlinkedCount: verificationResult.unlinkedJobs.length - (verificationResult.unlinkedJobs.length > 0 ? 0 : 0)
  };
}

/**
 * Complete batch processing and advance jobs back to main workflow
 */
export async function completeBatchProcessing(batchId: string, nextStageId?: string): Promise<boolean> {
  try {
    console.log(`🔄 Completing batch processing for batch ${batchId}`);

    // Get all jobs in this batch
    const { data: batchJobs, error: fetchError } = await supabase
      .from('production_jobs')
      .select('id, wo_no')
      .eq('batch_id', batchId)
      .eq('status', 'In Batch Processing');

    if (fetchError) {
      console.error('❌ Error fetching batch jobs:', fetchError);
      throw fetchError;
    }

    if (!batchJobs || batchJobs.length === 0) {
      console.log('ℹ️ No jobs found in batch processing status');
      return true;
    }

    // Update all jobs to advance to next stage
    for (const job of batchJobs) {
      try {
        // Update job status
        const { error: jobUpdateError } = await supabase
          .from('production_jobs')
          .update({
            status: nextStageId ? 'Ready to Print' : 'Batch Complete',
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        if (jobUpdateError) {
          console.error(`❌ Error updating job ${job.wo_no}:`, jobUpdateError);
          continue;
        }

        // If next stage specified, activate it
        if (nextStageId) {
          const { error: stageError } = await supabase
            .from('job_stage_instances')
            .update({
              status: 'active',
              started_at: new Date().toISOString(),
              notes: `Advanced from batch processing to next stage`
            })
            .eq('job_id', job.id)
            .eq('job_table_name', 'production_jobs')
            .eq('production_stage_id', nextStageId)
            .eq('status', 'pending');

          if (stageError) {
            console.error(`❌ Error activating next stage for job ${job.wo_no}:`, stageError);
          }
        }

        console.log(`✅ Job ${job.wo_no} advanced from batch processing`);
      } catch (error) {
        console.error(`❌ Error processing job ${job.wo_no}:`, error);
      }
    }

    console.log(`✅ Batch processing completed for ${batchJobs.length} jobs`);
    return true;
  } catch (error) {
    console.error('❌ Error completing batch processing:', error);
    toast.error("Failed to complete batch processing");
    return false;
  }
}
