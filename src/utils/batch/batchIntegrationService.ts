
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Unified service for integrating production jobs with batch processing
 */

export interface BatchIntegrationResult {
  success: boolean;
  batchJobId?: string;
  batchId?: string;
  error?: string;
}

export interface ProductionJobBatchData {
  productionJobId: string;
  wo_no: string;
  customer: string;
  qty: number;
  due_date: string;
  batchCategory: string;
}

/**
 * Create a batch job from production job data
 */
export async function createBatchJobFromProduction({
  productionJobId,
  wo_no,
  customer,
  qty,
  due_date,
  batchCategory
}: ProductionJobBatchData): Promise<BatchIntegrationResult> {
  try {
    console.log(`🔄 Creating ${batchCategory} batch job from production job ${wo_no}`);

    // Determine the target table based on batch category
    const batchTableName = getBatchTableFromCategory(batchCategory);
    
    if (!batchTableName) {
      throw new Error(`Unknown batch category: ${batchCategory}`);
    }

    // Create the batch job
    const { data: batchJob, error: createError } = await supabase
      .from(batchTableName)
      .insert({
        name: `Batch Job - ${wo_no}`,
        job_number: `BATCH-${wo_no}-${Date.now()}`,
        quantity: qty,
        due_date: due_date,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        pdf_url: '', // Will be populated later
        file_name: `${wo_no}_batch.pdf`,
        status: 'queued'
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    console.log(`✅ Created ${batchCategory} batch job:`, batchJob.id);

    // Update production job status
    const { error: updateError } = await supabase
      .from('production_jobs')
      .update({
        status: 'In Batch Processing',
        batch_ready: true,
        batch_allocated_at: new Date().toISOString(),
        batch_category: batchCategory,
        updated_at: new Date().toISOString()
      })
      .eq('id', productionJobId);

    if (updateError) {
      throw updateError;
    }

    // Create batch reference for tracking
    await createBatchReference(productionJobId, batchJob.id, batchTableName);

    return {
      success: true,
      batchJobId: batchJob.id,
      batchId: null // Will be set when job is added to a batch
    };

  } catch (error) {
    console.error(`❌ Error creating ${batchCategory} batch job:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Create a reference linking production job to batch job
 */
async function createBatchReference(productionJobId: string, batchJobId: string, batchTableName: string) {
  try {
    const { error } = await supabase
      .from('batch_job_references')
      .insert({
        production_job_id: productionJobId,
        batch_job_id: batchJobId,
        batch_job_table: batchTableName,
        status: 'processing'
      });

    if (error) {
      console.warn('⚠️ Could not create batch reference:', error);
    }
  } catch (error) {
    console.warn('⚠️ Batch reference creation failed:', error);
  }
}

/**
 * Complete batch processing and return job to production workflow
 */
export async function completeBatchJobProcessing(
  productionJobId: string,
  batchJobId: string,
  nextStageId?: string
): Promise<boolean> {
  try {
    console.log(`🔄 Completing batch processing for production job ${productionJobId}`);

    // Update production job status
    const newStatus = nextStageId ? 'Ready to Print' : 'Batch Complete';
    const { error: jobError } = await supabase
      .from('production_jobs')
      .update({
        status: newStatus,
        batch_ready: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', productionJobId);

    if (jobError) throw jobError;

    // Activate next stage if specified
    if (nextStageId) {
      await supabase
        .from('job_stage_instances')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          notes: 'Advanced from batch processing to next stage'
        })
        .eq('job_id', productionJobId)
        .eq('job_table_name', 'production_jobs')
        .eq('production_stage_id', nextStageId)
        .eq('status', 'pending');
    }

    // Update batch reference
    await supabase
      .from('batch_job_references')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('production_job_id', productionJobId);

    console.log(`✅ Completed batch processing for production job ${productionJobId}`);
    return true;

  } catch (error) {
    console.error('❌ Error completing batch processing:', error);
    return false;
  }
}

/**
 * Get jobs that are lost between systems
 */
export async function findLostJobs() {
  try {
    const { data: lostJobs, error } = await supabase
      .from('production_jobs')
      .select(`
        id,
        wo_no,
        customer,
        status,
        batch_category,
        batch_allocated_at,
        updated_at
      `)
      .eq('status', 'In Batch Processing')
      .is('batch_id', null);

    if (error) throw error;

    return lostJobs || [];
  } catch (error) {
    console.error('❌ Error finding lost jobs:', error);
    return [];
  }
}

/**
 * Recover a lost job by creating proper workflow stages
 */
export async function recoverLostJob(productionJobId: string): Promise<boolean> {
  try {
    console.log(`🔧 Recovering lost job: ${productionJobId}`);

    // Get job details
    const { data: job, error: fetchError } = await supabase
      .from('production_jobs')
      .select('*')
      .eq('id', productionJobId)
      .single();

    if (fetchError || !job) {
      throw new Error('Job not found');
    }

    // Reset job to a recoverable state
    const { error: resetError } = await supabase
      .from('production_jobs')
      .update({
        status: 'Ready for Batch Allocation',
        batch_ready: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', productionJobId);

    if (resetError) throw resetError;

    // Create batch allocation stage if needed
    if (job.category_id) {
      await supabase.rpc('initialize_job_stages_auto', {
        p_job_id: productionJobId,
        p_job_table_name: 'production_jobs',
        p_category_id: job.category_id
      });
    }

    console.log(`✅ Recovered lost job: ${productionJobId}`);
    return true;

  } catch (error) {
    console.error(`❌ Error recovering job ${productionJobId}:`, error);
    return false;
  }
}

/**
 * Map batch category to database table name
 */
function getBatchTableFromCategory(batchCategory: string): string | null {
  const categoryMap: Record<string, string> = {
    'business_cards': 'business_card_jobs',
    'flyers': 'flyer_jobs',
    'postcards': 'postcard_jobs',
    'posters': 'poster_jobs',
    'stickers': 'sticker_jobs',
    'covers': 'cover_jobs',
    'sleeves': 'sleeve_jobs',
    'boxes': 'box_jobs'
  };

  return categoryMap[batchCategory.toLowerCase()] || null;
}

/**
 * Get batch job details with production job reference
 */
export async function getBatchJobWithProductionDetails(batchJobId: string, batchTableName: string) {
  try {
    const { data, error } = await supabase
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
      .eq('batch_job_id', batchJobId)
      .eq('batch_job_table', batchTableName)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error fetching batch job with production details:', error);
    return null;
  }
}
