import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface BatchStageActionOptions {
  jobId: string;
  jobTableName: string;
  isBatchMaster?: boolean;
  batchName?: string;
  constituentJobIds?: string[];
}

/**
 * Enhanced stage actions with batch awareness
 * Handles stage operations for both individual jobs and batch master jobs
 */
export const useBatchAwareStageActions = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuth();

  const startStage = useCallback(async (
    stageId: string, 
    options: BatchStageActionOptions,
    qrData?: any
  ) => {
    setIsProcessing(true);
    try {
      console.log('🔄 Starting batch-aware stage...', { 
        stageId, 
        options, 
        qrData 
      });
      
      // Start the stage for the job (batch master or individual)
      const { error: stageError } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageId)
        .eq('status', 'pending');

      if (stageError) throw stageError;

      // If this is a batch master job, update constituent jobs status
      if (options.isBatchMaster && options.constituentJobIds?.length) {
        console.log('🔄 Updating constituent jobs for batch master stage start...', {
          batchName: options.batchName,
          constituentCount: options.constituentJobIds.length
        });

        // Update constituent jobs to reflect batch processing status
        const { error: statusError } = await supabase
          .from('production_jobs')
          .update({
            status: 'In Batch Processing',
            updated_at: new Date().toISOString()
          })
          .in('id', options.constituentJobIds);

        if (statusError) {
          console.warn('⚠️ Error updating constituent job status:', statusError);
          // Don't fail the operation for this
        }
      }

      toast.success(
        options.isBatchMaster 
          ? `Batch stage started: ${options.batchName}` 
          : "Stage started successfully"
      );
      return true;
    } catch (err) {
      console.error('❌ Error starting batch-aware stage:', err);
      toast.error("Failed to start stage");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  const completeStage = useCallback(async (
    stageId: string,
    options: BatchStageActionOptions,
    notes?: string
  ) => {
    setIsProcessing(true);
    try {
      console.log('🔄 [useBatchAwareStageActions] Completing batch-aware stage...', { 
        stageId, 
        options, 
        notes 
      });
      
      // Get stage info to check if it's a proof stage
      const { getStageInfoForProofCheck, triggerProofCompletionCalculation } = await import('../utils/proofStageUtils');
      const stageInfo = await getStageInfoForProofCheck(stageId);
      
      // Check if this job has parallel components (cover/text workflow)
      const { data: parallelCheck } = await supabase
        .from('job_stage_instances')
        .select('part_assignment, dependency_group')
        .eq('job_id', options.jobId)
        .eq('job_table_name', options.jobTableName)
        .neq('part_assignment', 'both');
      
      const hasParallelComponents = parallelCheck && parallelCheck.length > 0;
      
      // Use parallel-aware advancement for jobs with cover/text components
      console.log(`🔄 Job advancement decision`, {
        hasParallelComponents,
        parallelComponentsFound: parallelCheck?.length || 0,
        functionToUse: hasParallelComponents ? 'advance_parallel_job_stage' : 'advance_job_stage'
      });
      
      let advanceError;
      if (hasParallelComponents) {
        // Use parallel-aware advancement for cover/text jobs
        const { error } = await supabase.rpc('advance_parallel_job_stage' as any, {
          p_job_id: options.jobId,
          p_job_table_name: options.jobTableName,
          p_current_stage_id: stageId,
          p_completed_by: user?.id,
          p_notes: notes
        });
        advanceError = error;
      } else {
        // Use standard advancement for regular jobs
        const { error } = await supabase.rpc('advance_job_stage', {
          p_job_id: options.jobId,
          p_job_table_name: options.jobTableName,
          p_current_stage_id: stageId,
          p_completed_by: user?.id,
          p_notes: notes
        });
        advanceError = error;
      }

      if (advanceError) throw advanceError;

      // If this was a proof stage completion, trigger queue-based due date calculation
      if (stageInfo?.isProof && options.jobId) {
        await triggerProofCompletionCalculation(options.jobId, options.jobTableName);
      }

      // If this is a batch master job, handle batch-specific completion logic
      if (options.isBatchMaster && options.constituentJobIds?.length) {
        console.log('🔄 Handling batch master stage completion...', {
          batchName: options.batchName,
          constituentCount: options.constituentJobIds.length
        });

        // Note: Constituent job updates are handled by the batch stage progression hook
        // This ensures proper coordination between batch and individual job states
      }

      toast.success(
        options.isBatchMaster 
          ? `Batch stage completed: ${options.batchName}` 
          : "Stage completed successfully"
      );
      return true;
    } catch (err) {
      console.error('❌ [useBatchAwareStageActions] Error completing batch-aware stage:', err);
      toast.error("Failed to complete stage");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  const reworkStage = useCallback(async (
    currentStageId: string,
    targetStageId: string,
    options: BatchStageActionOptions,
    reworkReason?: string
  ) => {
    setIsProcessing(true);
    try {
      console.log('🔄 Reworking batch-aware stage...', { 
        currentStageId, 
        targetStageId, 
        options, 
        reworkReason 
      });

      // Use the standard rework function
      const { error } = await supabase.rpc('rework_job_stage', {
        p_job_id: options.jobId,
        p_job_table_name: options.jobTableName,
        p_current_stage_instance_id: currentStageId,
        p_target_stage_id: targetStageId,
        p_rework_reason: reworkReason,
        p_reworked_by: user?.id
      });

      if (error) throw error;

      // If this is a batch master job, update constituent jobs
      if (options.isBatchMaster && options.constituentJobIds?.length) {
        console.log('🔄 Updating constituent jobs for batch rework...', {
          batchName: options.batchName,
          constituentCount: options.constituentJobIds.length
        });

        // Update constituent jobs to reflect rework status
        const { error: statusError } = await supabase
          .from('production_jobs')
          .update({
            status: 'Rework Required',
            updated_at: new Date().toISOString()
          })
          .in('id', options.constituentJobIds);

        if (statusError) {
          console.warn('⚠️ Error updating constituent job status for rework:', statusError);
        }
      }

      toast.success(
        options.isBatchMaster 
          ? `Batch stage sent for rework: ${options.batchName}` 
          : "Stage sent for rework"
      );
      return true;
    } catch (err) {
      console.error('❌ Error reworking batch-aware stage:', err);
      toast.error("Failed to rework stage");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  return {
    startStage,
    completeStage,
    reworkStage,
    isProcessing
  };
};