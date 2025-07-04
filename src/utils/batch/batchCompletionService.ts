import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Enhanced batch completion service with proper sync between batch master jobs and individual jobs
 */

interface BatchCompletionResult {
  success: boolean;
  completedJobs: number;
  failedJobs: number;
  errors: string[];
}

interface BatchMasterJobInfo {
  id: string;
  wo_no: string;
  batch_name: string;
  constituent_jobs: number;
}

/**
 * Complete batch processing with enhanced synchronization
 */
export async function completeBatchProcessingEnhanced(
  batchId: string, 
  nextStageId?: string
): Promise<BatchCompletionResult> {
  const result: BatchCompletionResult = {
    success: false,
    completedJobs: 0,
    failedJobs: 0,
    errors: []
  };

  try {
    console.log(`🔄 Enhanced batch completion for batch ${batchId}`);

    // Step 1: Find and handle batch master job
    const batchMasterJob = await findBatchMasterJob(batchId);
    if (batchMasterJob) {
      await completeBatchMasterJob(batchMasterJob, nextStageId);
      console.log(`✅ Completed batch master job: ${batchMasterJob.wo_no}`);
    }

    // Step 2: Get all constituent jobs from batch references
    const { data: batchRefs, error: fetchError } = await supabase
      .from('batch_job_references')
      .select(`
        production_job_id,
        batch_job_id,
        batch_job_table,
        production_jobs (
          id,
          wo_no,
          customer,
          status
        )
      `)
      .eq('batch_id', batchId)
      .eq('status', 'processing');

    if (fetchError) {
      result.errors.push(`Failed to fetch batch references: ${fetchError.message}`);
      return result;
    }

    if (!batchRefs || batchRefs.length === 0) {
      result.errors.push('No jobs found in batch references');
      return result;
    }

    // Step 3: Complete each constituent job with proper synchronization
    for (const ref of batchRefs) {
      try {
        const success = await completeConstituentJob(
          ref.production_job_id,
          ref.batch_job_id,
          batchId,
          nextStageId
        );

        if (success) {
          result.completedJobs++;
          console.log(`✅ Completed constituent job: ${ref.production_jobs?.wo_no}`);
        } else {
          result.failedJobs++;
          result.errors.push(`Failed to complete job: ${ref.production_jobs?.wo_no}`);
        }
      } catch (error) {
        result.failedJobs++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Error completing job ${ref.production_jobs?.wo_no}: ${errorMsg}`);
      }
    }

    // Step 4: Update batch status
    await updateBatchCompletionStatus(batchId, result);

    // Step 5: Clean up batch references
    await cleanupBatchReferences(batchId);

    result.success = result.failedJobs === 0;

    if (result.success) {
      toast.success(`Batch completed successfully: ${result.completedJobs} jobs processed`);
    } else {
      toast.warning(`Batch completed with issues: ${result.completedJobs} succeeded, ${result.failedJobs} failed`);
    }

    return result;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Batch completion failed: ${errorMsg}`);
    console.error('❌ Enhanced batch completion failed:', error);
    toast.error('Failed to complete batch processing');
    return result;
  }
}

/**
 * Find the batch master job for a given batch
 */
async function findBatchMasterJob(batchId: string): Promise<BatchMasterJobInfo | null> {
  try {
    // Get batch name first
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('name')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) {
      console.warn('⚠️ Could not find batch:', batchError);
      return null;
    }

    // Find production job with matching batch WO number pattern
    const { data: batchJob, error: jobError } = await supabase
      .from('production_jobs')
      .select('id, wo_no, qty')
      .eq('wo_no', `BATCH-${batch.name}`)
      .maybeSingle();

    if (jobError || !batchJob) {
      console.warn('⚠️ No batch master job found for batch:', batch.name);
      return null;
    }

    return {
      id: batchJob.id,
      wo_no: batchJob.wo_no,
      batch_name: batch.name,
      constituent_jobs: batchJob.qty || 0
    };
  } catch (error) {
    console.error('❌ Error finding batch master job:', error);
    return null;
  }
}

/**
 * Complete the batch master job and advance its workflow
 */
async function completeBatchMasterJob(
  batchMasterJob: BatchMasterJobInfo,
  nextStageId?: string
): Promise<void> {
  try {
    // Complete current active stage of batch master job
    await supabase
      .from('job_stage_instances')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        notes: `Batch processing completed for ${batchMasterJob.constituent_jobs} jobs`
      })
      .eq('job_id', batchMasterJob.id)
      .eq('job_table_name', 'production_jobs')
      .eq('status', 'active');

    // Update batch master job status
    await supabase
      .from('production_jobs')
      .update({
        status: 'Batch Complete',
        updated_at: new Date().toISOString()
      })
      .eq('id', batchMasterJob.id);

    // Activate next stage if specified
    if (nextStageId) {
      await supabase
        .from('job_stage_instances')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          notes: 'Advanced from batch completion to next stage'
        })
        .eq('job_id', batchMasterJob.id)
        .eq('job_table_name', 'production_jobs')
        .eq('production_stage_id', nextStageId)
        .eq('status', 'pending');
    }

  } catch (error) {
    console.error('❌ Error completing batch master job:', error);
    throw error;
  }
}

/**
 * Complete individual constituent job and sync with batch status
 */
async function completeConstituentJob(
  productionJobId: string,
  batchJobId: string,
  batchId: string,
  nextStageId?: string
): Promise<boolean> {
  try {
    // Complete any active Batch Allocation stages
    await supabase
      .from('job_stage_instances')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        notes: 'Batch processing completed - returning to main workflow'
      })
      .eq('job_id', productionJobId)
      .eq('job_table_name', 'production_jobs')
      .eq('status', 'active');

    // Update production job status and clear batch flags
    const newStatus = nextStageId ? 'Ready to Print' : 'Batch Complete';
    await supabase
      .from('production_jobs')
      .update({
        status: newStatus,
        batch_ready: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', productionJobId);

    // Activate next stage if specified
    if (nextStageId) {
      await supabase
        .from('job_stage_instances')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          notes: 'Returned from batch processing to main workflow'
        })
        .eq('job_id', productionJobId)
        .eq('job_table_name', 'production_jobs')
        .eq('production_stage_id', nextStageId)
        .eq('status', 'pending');
    }

    // Update batch reference status
    await supabase
      .from('batch_job_references')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('production_job_id', productionJobId)
      .eq('batch_id', batchId);

    return true;
  } catch (error) {
    console.error(`❌ Error completing constituent job ${productionJobId}:`, error);
    return false;
  }
}

/**
 * Update batch completion status and metrics
 */
async function updateBatchCompletionStatus(
  batchId: string,
  result: BatchCompletionResult
): Promise<void> {
  try {
    const status = result.success ? 'completed' : 'processing';
    
    await supabase
      .from('batches')
      .update({
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', batchId);

  } catch (error) {
    console.warn('⚠️ Error updating batch completion status:', error);
  }
}

/**
 * Clean up completed batch references
 */
async function cleanupBatchReferences(batchId: string): Promise<void> {
  try {
    // Archive completed references rather than delete them for audit trail
    await supabase
      .from('batch_job_references')
      .update({
        status: 'archived',
        notes: 'Batch processing completed successfully'
      })
      .eq('batch_id', batchId)
      .eq('status', 'completed');

  } catch (error) {
    console.warn('⚠️ Error cleaning up batch references:', error);
  }
}

/**
 * Get batch completion statistics
 */
export async function getBatchCompletionStats(batchId: string): Promise<{
  totalJobs: number;
  completedJobs: number;
  processingJobs: number;
  failedJobs: number;
}> {
  try {
    const { data: refs, error } = await supabase
      .from('batch_job_references')
      .select('status')
      .eq('batch_id', batchId);

    if (error || !refs) {
      return { totalJobs: 0, completedJobs: 0, processingJobs: 0, failedJobs: 0 };
    }

    const stats = refs.reduce((acc, ref) => {
      acc.totalJobs++;
      switch (ref.status) {
        case 'completed':
        case 'archived':
          acc.completedJobs++;
          break;
        case 'processing':
          acc.processingJobs++;
          break;
        case 'failed':
          acc.failedJobs++;
          break;
      }
      return acc;
    }, { totalJobs: 0, completedJobs: 0, processingJobs: 0, failedJobs: 0 });

    return stats;
  } catch (error) {
    console.error('❌ Error getting batch completion stats:', error);
    return { totalJobs: 0, completedJobs: 0, processingJobs: 0, failedJobs: 0 };
  }
}