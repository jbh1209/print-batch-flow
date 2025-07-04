import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BatchSplitResult {
  success: boolean;
  splitJobsCount: number;
  message: string;
  splitJobs?: {
    job_id: string;
    wo_no: string;
    next_stage: string;
  }[];
}

export interface BatchSplitOptions {
  batchJobId: string;
  targetStageId?: string;
  splitReason?: string;
  userId?: string;
}

/**
 * Core batch splitting service that handles the complex logic of splitting 
 * batch master jobs back into individual production jobs
 */
export class BatchSplittingService {
  
  /**
   * Split a batch master job back into individual production jobs
   * This is typically called at the packaging stage
   */
  static async splitBatchToIndividualJobs({
    batchJobId,
    targetStageId,
    splitReason = 'Batch completed - returning to individual workflow',
    userId
  }: BatchSplitOptions): Promise<BatchSplitResult> {
    try {
      console.log('🔄 Starting batch split operation:', { batchJobId, targetStageId });

      // Step 1: Get the batch master job details
      const { data: batchJob, error: batchJobError } = await supabase
        .from('production_jobs')
        .select('wo_no, batch_category, category_id')
        .eq('id', batchJobId)
        .single();

      if (batchJobError || !batchJob) {
        throw new Error('Could not find batch master job');
      }

      // Verify this is actually a batch master job
      if (!batchJob.wo_no.startsWith('BATCH-')) {
        throw new Error('Job is not a batch master job');
      }

      const batchName = batchJob.wo_no.replace('BATCH-', '');

      // Step 2: Get the batch record
      const { data: batch, error: batchError } = await supabase
        .from('batches')
        .select('id, status')
        .eq('name', batchName)
        .single();

      if (batchError || !batch) {
        throw new Error(`Could not find batch with name: ${batchName}`);
      }

      // Step 3: Get all constituent jobs linked to this batch
      const { data: batchRefs, error: batchRefsError } = await supabase
        .from('batch_job_references')
        .select(`
          production_job_id,
          batch_job_table,
          status
        `)
        .eq('batch_id', batch.id)
        .eq('status', 'processing');

      if (batchRefsError) {
        throw new Error(`Failed to fetch batch job references: ${batchRefsError.message}`);
      }

      if (!batchRefs || batchRefs.length === 0) {
        console.warn('No active batch job references found');
        return {
          success: true,
          splitJobsCount: 0,
          message: 'No jobs to split - batch may already be processed'
        };
      }

      console.log(`📦 Found ${batchRefs.length} jobs to split from batch`);

      // Step 4: Determine the target stage for split jobs
      let nextStageId = targetStageId;
      
      if (!nextStageId) {
        // Get the next stage after the current batch stage
        const { data: nextStage } = await supabase
          .from('job_stage_instances')
          .select('production_stage_id, stage_order')
          .eq('job_id', batchJobId)
          .eq('job_table_name', 'production_jobs')
          .eq('status', 'active')
          .single();

        if (nextStage) {
          // Find the next stage in the workflow
          const { data: followingStage } = await supabase
            .from('category_production_stages')
            .select('production_stage_id')
            .eq('category_id', batchJob.category_id)
            .gt('stage_order', nextStage.stage_order)
            .order('stage_order', { ascending: true })
            .limit(1)
            .single();

          nextStageId = followingStage?.production_stage_id;
        }
      }

      // Step 5: Process each constituent job
      const splitJobs = [];
      const timestamp = new Date().toISOString();
      
      for (const ref of batchRefs) {
        try {
          // Update the production job status
          const { error: updateJobError } = await supabase
            .from('production_jobs')
            .update({
              status: 'In Progress', // Return to normal workflow
              batch_ready: false,
              batch_allocated_at: null,
              batch_allocated_by: null,
              updated_at: timestamp
            })
            .eq('id', ref.production_job_id);

          if (updateJobError) {
            console.error(`Failed to update production job ${ref.production_job_id}:`, updateJobError);
            continue;
          }

          // If we have a target stage, initialize the job at that stage
          if (nextStageId) {
            // Clear any existing active stages
            await supabase
              .from('job_stage_instances')
              .update({ 
                status: 'completed',
                completed_at: timestamp,
                completed_by: userId,
                notes: `Completed via batch processing: ${splitReason}`
              })
              .eq('job_id', ref.production_job_id)
              .eq('job_table_name', 'production_jobs')
              .eq('status', 'active');

            // Activate the target stage
            const { error: stageError } = await supabase
              .from('job_stage_instances')
              .update({
                status: 'active',
                started_at: timestamp,
                started_by: userId,
                notes: `Started after batch split: ${splitReason}`
              })
              .eq('job_id', ref.production_job_id)
              .eq('job_table_name', 'production_jobs')
              .eq('production_stage_id', nextStageId)
              .eq('status', 'pending');

            if (stageError) {
              console.error(`Failed to activate stage for job ${ref.production_job_id}:`, stageError);
            }
          }

          // Update batch reference status
          const { error: refUpdateError } = await supabase
            .from('batch_job_references')
            .update({
              status: 'completed',
              completed_at: timestamp,
              notes: splitReason
            })
            .eq('production_job_id', ref.production_job_id)
            .eq('batch_id', batch.id);

          if (refUpdateError) {
            console.error(`Failed to update batch reference for job ${ref.production_job_id}:`, refUpdateError);
          }

          // Get the job details for audit trail
          const { data: jobDetails } = await supabase
            .from('production_jobs')
            .select('wo_no')
            .eq('id', ref.production_job_id)
            .single();

          splitJobs.push({
            job_id: ref.production_job_id,
            wo_no: jobDetails?.wo_no || 'Unknown',
            next_stage: nextStageId || 'Next in workflow'
          });

        } catch (jobError) {
          console.error(`Error processing job ${ref.production_job_id}:`, jobError);
        }
      }

      // Step 6: Update batch status to completed
      const { error: batchUpdateError } = await supabase
        .from('batches')
        .update({
          status: 'completed',
          updated_at: timestamp
        })
        .eq('id', batch.id);

      if (batchUpdateError) {
        console.warn('Failed to update batch status:', batchUpdateError);
      }

      // Step 7: Complete the batch master job
      const { error: batchJobUpdateError } = await supabase
        .from('production_jobs')
        .update({
          status: 'Completed',
          updated_at: timestamp
        })
        .eq('id', batchJobId);

      if (batchJobUpdateError) {
        console.warn('Failed to complete batch master job:', batchJobUpdateError);
      }

      // Step 8: Complete all remaining stage instances for batch master job
      await supabase
        .from('job_stage_instances')
        .update({
          status: 'completed',
          completed_at: timestamp,
          completed_by: userId,
          notes: `Batch completed and split: ${splitReason}`
        })
        .eq('job_id', batchJobId)
        .eq('job_table_name', 'production_jobs')
        .in('status', ['active', 'pending']);

      console.log(`✅ Successfully split batch ${batchName} into ${splitJobs.length} individual jobs`);

      return {
        success: true,
        splitJobsCount: splitJobs.length,
        message: `Successfully split batch ${batchName} into ${splitJobs.length} individual jobs`,
        splitJobs
      };

    } catch (error) {
      console.error('❌ Batch splitting failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during batch split';
      
      return {
        success: false,
        splitJobsCount: 0,
        message: `Batch split failed: ${errorMessage}`
      };
    }
  }

  /**
   * Check if a batch is ready for splitting
   */
  static async isBatchReadyForSplit(batchJobId: string): Promise<{
    ready: boolean;
    reason: string;
    currentStage?: string;
  }> {
    try {
      // Get current stage info
      const { data: stageInfo, error } = await supabase
        .from('job_stage_instances')
        .select(`
          production_stage_id,
          status,
          production_stages (
            name
          )
        `)
        .eq('job_id', batchJobId)
        .eq('job_table_name', 'production_jobs')
        .eq('status', 'active')
        .single();

      if (error || !stageInfo) {
        return {
          ready: false,
          reason: 'No active stage found for batch job'
        };
      }

      const stageName = stageInfo.production_stages?.name || '';
      const isPackagingStage = stageName.toLowerCase().includes('packaging');
      const isFinishingStage = stageName.toLowerCase().includes('finishing');
      const isSplitEligibleStage = isPackagingStage || isFinishingStage;

      return {
        ready: isSplitEligibleStage,
        reason: isSplitEligibleStage 
          ? `Ready for split at ${stageName} stage`
          : `Not at a split-eligible stage (current: ${stageName})`,
        currentStage: stageName
      };

    } catch (error) {
      return {
        ready: false,
        reason: `Error checking split readiness: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get audit trail for a batch split operation
   */
  static async getBatchSplitAuditTrail(batchJobId: string): Promise<{
    batchInfo?: {
      batchName: string;
      originalJobCount: number;
      splitAt: string;
    };
    splitJobs?: Array<{
      jobId: string;
      woNo: string;
      splitStatus: string;
      currentStage: string;
    }>;
  }> {
    try {
      // Get batch master job info
      const { data: batchJob } = await supabase
        .from('production_jobs')
        .select('wo_no, updated_at')
        .eq('id', batchJobId)
        .single();

      if (!batchJob || !batchJob.wo_no.startsWith('BATCH-')) {
        return {};
      }

      const batchName = batchJob.wo_no.replace('BATCH-', '');

      // Get batch record
      const { data: batch } = await supabase
        .from('batches')
        .select('id')
        .eq('name', batchName)
        .single();

      if (!batch) return {};

      // Get completed batch references
      const { data: completedRefs } = await supabase
        .from('batch_job_references')
        .select(`
          production_job_id,
          completed_at,
          notes
        `)
        .eq('batch_id', batch.id)
        .eq('status', 'completed');

      const splitJobs = [];
      if (completedRefs) {
        for (const ref of completedRefs) {
          const { data: jobInfo } = await supabase
            .from('production_jobs')
            .select('wo_no, status')
            .eq('id', ref.production_job_id)
            .single();

          const { data: currentStage } = await supabase
            .from('job_stage_instances')
            .select(`
              production_stages (name)
            `)
            .eq('job_id', ref.production_job_id)
            .eq('job_table_name', 'production_jobs')
            .eq('status', 'active')
            .single();

          splitJobs.push({
            jobId: ref.production_job_id,
            woNo: jobInfo?.wo_no || 'Unknown',
            splitStatus: jobInfo?.status || 'Unknown',
            currentStage: currentStage?.production_stages?.name || 'No active stage'
          });
        }
      }

      return {
        batchInfo: {
          batchName,
          originalJobCount: completedRefs?.length || 0,
          splitAt: batchJob.updated_at || 'Unknown'
        },
        splitJobs
      };

    } catch (error) {
      console.error('Error fetching batch split audit trail:', error);
      return {};
    }
  }
}