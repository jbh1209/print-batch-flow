
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Unified batch processor that handles production jobs properly
 * without creating duplicates or losing synchronization
 */

interface UnifiedBatchProcessParams {
  productionJobIds: string[];
  batchId: string;
  batchType: string; // e.g., 'business_cards', 'flyers', etc.
}

interface UnifiedBatchResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors: string[];
}

/**
 * Process production jobs for batch integration without duplication
 */
export async function processProductionJobsForBatch({
  productionJobIds,
  batchId,
  batchType
}: UnifiedBatchProcessParams): Promise<UnifiedBatchResult> {
  
  const result: UnifiedBatchResult = {
    success: true,
    processedCount: 0,
    failedCount: 0,
    errors: []
  };

  if (productionJobIds.length === 0) {
    return result;
  }

  console.log(`🔄 Processing ${productionJobIds.length} production jobs for batch integration`);

  for (const jobId of productionJobIds) {
    try {
      // Get the production job details
      const { data: productionJob, error: fetchError } = await supabase
        .from('production_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (fetchError || !productionJob) {
        console.error(`❌ Error fetching production job ${jobId}:`, fetchError);
        result.failedCount++;
        result.errors.push(`Failed to fetch job ${jobId}`);
        continue;
      }

      // Update production job to batch processing status
      const { error: updateError } = await supabase
        .from('production_jobs')
        .update({
          status: 'In Batch Processing',
          batch_ready: true,
          batch_allocated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (updateError) {
        console.error(`❌ Error updating production job ${jobId}:`, updateError);
        result.failedCount++;
        result.errors.push(`Failed to update job ${jobId}`);
        continue;
      }

      // Complete current active stages
      await supabase
        .from('job_stage_instances')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          notes: `Job moved to ${batchType} batch processing - Batch ID: ${batchId}`
        })
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .eq('status', 'active');

      // Create batch reference instead of duplicating job data
      try {
        const { error: refError } = await (supabase as any)
          .from('batch_job_references')
          .insert({
            production_job_id: jobId,
            batch_id: batchId,
            batch_job_table: getBatchTableName(batchType),
            status: 'processing',
            created_at: new Date().toISOString()
          });

        if (refError) {
          console.warn(`⚠️ Could not create batch reference for job ${jobId}:`, refError);
          // This is non-critical, so we don't fail the entire operation
        }
      } catch (error) {
        console.warn(`⚠️ Batch reference creation failed for job ${jobId}:`, error);
      }

      result.processedCount++;
      console.log(`✅ Production job ${jobId} successfully processed for batch`);

    } catch (error) {
      console.error(`❌ Error processing job ${jobId}:`, error);
      result.failedCount++;
      result.errors.push(`Exception processing job ${jobId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  result.success = result.failedCount === 0;

  console.log(`✅ Batch processing completed: ${result.processedCount} successful, ${result.failedCount} failed`);

  if (result.failedCount > 0) {
    toast.warning(`${result.failedCount} jobs could not be processed for batching`, {
      description: "Check console for details"
    });
  } else {
    toast.success(`${result.processedCount} jobs successfully added to batch`);
  }

  return result;
}

/**
 * Complete batch processing and return jobs to production workflow
 */
export async function completeBatchForProductionJobs(
  batchId: string,
  nextStageId?: string
): Promise<boolean> {
  try {
    console.log(`🔄 Completing batch processing for batch ${batchId}`);

    // Get all production jobs in this batch using type assertion
    const { data: batchRefs, error: fetchError } = await (supabase as any)
      .from('batch_job_references')
      .select('production_job_id')
      .eq('batch_id', batchId)
      .eq('status', 'processing');

    if (fetchError) {
      console.error('❌ Error fetching batch references:', fetchError);
      throw fetchError;
    }

    if (!batchRefs || batchRefs.length === 0) {
      console.log('ℹ️ No production jobs found for this batch');
      return true;
    }

    const productionJobIds = batchRefs.map((ref: any) => ref.production_job_id);

    // Update all production jobs
    for (const jobId of productionJobIds) {
      try {
        // Update job status
        const newStatus = nextStageId ? 'Ready to Print' : 'Batch Complete';
        const { error: jobUpdateError } = await supabase
          .from('production_jobs')
          .update({
            status: newStatus,
            batch_ready: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);

        if (jobUpdateError) {
          console.error(`❌ Error updating production job ${jobId}:`, jobUpdateError);
          continue;
        }

        // Activate next stage if specified
        if (nextStageId) {
          await supabase
            .from('job_stage_instances')
            .update({
              status: 'active',
              started_at: new Date().toISOString(),
              notes: 'Advanced from batch processing to next stage'
            })
            .eq('job_id', jobId)
            .eq('job_table_name', 'production_jobs')
            .eq('production_stage_id', nextStageId)
            .eq('status', 'pending');
        }

        console.log(`✅ Production job ${jobId} completed batch processing`);
      } catch (error) {
        console.error(`❌ Error processing job ${jobId}:`, error);
      }
    }

    // Update batch references using type assertion
    try {
      await (supabase as any)
        .from('batch_job_references')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('batch_id', batchId);
    } catch (error) {
      console.warn('⚠️ Could not update batch references:', error);
    }

    console.log(`✅ Batch processing completed for ${productionJobIds.length} jobs`);
    return true;

  } catch (error) {
    console.error('❌ Error completing batch processing:', error);
    toast.error("Failed to complete batch processing");
    return false;
  }
}

/**
 * Helper function to get the appropriate batch table name
 */
function getBatchTableName(batchType: string): string {
  const tableMap: Record<string, string> = {
    'business_cards': 'business_card_jobs',
    'flyers': 'flyer_jobs',
    'postcards': 'postcard_jobs',
    'posters': 'poster_jobs',
    'stickers': 'sticker_jobs',
    'covers': 'cover_jobs',
    'sleeves': 'sleeve_jobs',
    'boxes': 'box_jobs'
  };

  return tableMap[batchType] || 'production_jobs';
}

/**
 * Get batch jobs with their production job details
 */
export async function getBatchJobsWithProductionDetails(batchId: string) {
  try {
    const { data, error } = await (supabase as any)
      .from('batch_job_references')
      .select(`
        *,
        production_jobs (
          id,
          wo_no,
          customer,
          reference,
          qty,
          due_date,
          status
        )
      `)
      .eq('batch_id', batchId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching batch jobs with production details:', error);
    return [];
  }
}
