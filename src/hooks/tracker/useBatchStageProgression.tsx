import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { completeBatchProcessing } from "@/utils/batch/batchJobProcessor";

export const useBatchStageProgression = () => {
  const { user } = useAuth();

  const completeBatchStage = useCallback(async (
    batchJobId: string,
    nextStageId?: string
  ): Promise<boolean> => {
    try {
      console.log('🔄 Completing batch stage for:', { batchJobId, nextStageId });

      // Get the current stage of the batch master job
      const { data: batchJob, error: batchJobError } = await supabase
        .from('production_jobs')
        .select('wo_no, batch_category')
        .eq('id', batchJobId)
        .single();

      if (batchJobError || !batchJob) {
        throw new Error('Could not find batch master job');
      }

      // Extract batch name from WO number
      const batchName = batchJob.wo_no.replace('BATCH-', '');

      // Get the batch ID
      const { data: batch, error: batchError } = await supabase
        .from('batches')
        .select('id, status')
        .eq('name', batchName)
        .single();

      if (batchError || !batch) {
        throw new Error('Could not find batch');
      }

      // Check if this is the final stage (e.g., packaging or finishing)
      const { data: stageInfo, error: stageError } = await supabase
        .from('job_stage_instances')
        .select(`
          production_stage_id,
          stage_order,
          production_stages (
            name
          )
        `)
        .eq('job_id', batchJobId)
        .eq('job_table_name', 'production_jobs')
        .eq('status', 'active')
        .single();

      if (stageError) {
        throw new Error('Could not find current stage');
      }

      const isPackagingStage = stageInfo.production_stages?.name?.toLowerCase().includes('packaging');
      const isFinishingStage = stageInfo.production_stages?.name?.toLowerCase().includes('finishing');
      const isFinalStage = isPackagingStage || isFinishingStage;

      // Complete the batch master job stage using the standard function
      const { error: advanceError } = await supabase.rpc('advance_job_stage', {
        p_job_id: batchJobId,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: stageInfo.production_stage_id,
        p_completed_by: user?.id
      });

      if (advanceError) {
        throw new Error(`Failed to advance batch stage: ${advanceError.message}`);
      }

      // If this is a final stage (packaging/finishing), split the batch back to individual jobs
      if (isFinalStage) {
        console.log('🔄 Final stage reached - completing batch processing...');
        
        const completionSuccess = await completeBatchProcessing(batch.id, nextStageId);
        
        if (completionSuccess) {
          toast.success(`Batch ${batchName} completed and jobs returned to individual workflow`);
        } else {
          toast.warning(`Batch stage completed but there were issues splitting back to individual jobs`);
        }
      } else {
        toast.success(`Batch stage completed successfully`);
      }

      return true;
    } catch (error) {
      console.error('❌ Error completing batch stage:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete batch stage';
      toast.error(errorMessage);
      return false;
    }
  }, [user?.id]);

  const startBatchStage = useCallback(async (
    batchJobId: string,
    stageId?: string
  ): Promise<boolean> => {
    try {
      console.log('🔄 Starting batch stage for:', { batchJobId, stageId });

      // If no stage ID provided, get the current pending stage
      if (!stageId) {
        const { data: nextStage, error: stageError } = await supabase
          .from('job_stage_instances')
          .select('production_stage_id')
          .eq('job_id', batchJobId)
          .eq('job_table_name', 'production_jobs')
          .eq('status', 'pending')
          .order('stage_order', { ascending: true })
          .limit(1)
          .single();

        if (stageError || !nextStage) {
          throw new Error('No pending stage found to start');
        }

        stageId = nextStage.production_stage_id;
      }

      // Start the batch master job stage
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: user?.id
        })
        .eq('job_id', batchJobId)
        .eq('job_table_name', 'production_jobs')
        .eq('production_stage_id', stageId)
        .eq('status', 'pending');

      if (error) {
        throw new Error(`Failed to start batch stage: ${error.message}`);
      }

      toast.success('Batch stage started successfully');
      return true;
    } catch (error) {
      console.error('❌ Error starting batch stage:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start batch stage';
      toast.error(errorMessage);
      return false;
    }
  }, [user?.id]);

  return {
    completeBatchStage,
    startBatchStage
  };
};