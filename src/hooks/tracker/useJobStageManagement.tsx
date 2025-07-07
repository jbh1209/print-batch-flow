
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useJobStageInstances } from "./useJobStageInstances";
import { useStageRework } from "./useStageRework";
import { useStageActions } from "./stage-management/useStageActions";
import { useStageValidation } from "./stage-management/useStageValidation";
import { useBatchAwareStageActions } from "./stage-management/useBatchAwareStageActions";
import { useBatchAwareStageValidation } from "./stage-management/useBatchAwareStageValidation";

interface JobStageManagementOptions {
  jobId: string;
  jobTableName: string;
  categoryId?: string;
  // Batch context for enhanced functionality
  isBatchMaster?: boolean;
  batchName?: string;
  constituentJobIds?: string[];
  job?: {
    id: string;
    is_batch_master?: boolean;
    batch_name?: string;
    constituent_jobs_count?: number;
    batch_ready?: boolean;
  };
}

export const useJobStageManagement = ({ 
  jobId, 
  jobTableName, 
  categoryId,
  isBatchMaster = false,
  batchName,
  constituentJobIds = [],
  job
}: JobStageManagementOptions) => {
  const [isProcessing, setIsProcessing] = useState(false);
  
  const {
    instances: jobStages,
    isLoading,
    error,
    refreshInstances: fetchJobStages
  } = useJobStageInstances([jobId], jobTableName);

  const { reworkStage, fetchReworkHistory, reworkHistory, isReworking } = useStageRework();
  const { startStage, completeStage } = useStageActions();
  const batchAwareActions = useBatchAwareStageActions();
  
  // Use batch-aware validation if batch context is provided
  const standardValidation = useStageValidation(jobStages);
  const batchValidation = useBatchAwareStageValidation(jobStages, job);
  
  const validation = (isBatchMaster || job?.batch_ready) ? batchValidation : standardValidation;

  // Initialize job with workflow stages based on category - ALL STAGES START AS PENDING
  const initializeJobWorkflow = useCallback(async () => {
    if (!categoryId) {
      toast.error("Category is required to initialize workflow");
      return false;
    }

    setIsProcessing(true);
    try {
      console.log('🔄 Initializing job workflow (all stages pending)...', { jobId, jobTableName, categoryId });
      
      const { error } = await supabase.rpc('initialize_job_stages_auto', {
        p_job_id: jobId,
        p_job_table_name: jobTableName,
        p_category_id: categoryId
      });
      
      const success = !error;
      
      if (success) {
        await fetchJobStages();
        await updateJobStatusToCurrentStage();
        toast.success("Job workflow initialized - stages ready to start manually");
      }
      
      return success;
    } catch (err) {
      console.error('❌ Error initializing job workflow:', err);
      toast.error("Failed to initialize job workflow");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [jobId, jobTableName, categoryId, fetchJobStages]);

  // Enhanced stage start with batch awareness
  const startStageEnhanced = useCallback(async (stageId: string, qrData?: any) => {
    if (isBatchMaster || job?.batch_ready) {
      return await batchAwareActions.startStage(stageId, {
        jobId,
        jobTableName,
        isBatchMaster,
        batchName,
        constituentJobIds
      }, qrData);
    } else {
      return await startStage(stageId, qrData);
    }
  }, [batchAwareActions, startStage, isBatchMaster, job, jobId, jobTableName, batchName, constituentJobIds]);

  // Enhanced stage completion with batch awareness
  const completeStageEnhanced = useCallback(async (stageId: string, notes?: string) => {
    if (isBatchMaster || job?.batch_ready) {
      const success = await batchAwareActions.completeStage(stageId, {
        jobId,
        jobTableName,
        isBatchMaster,
        batchName,
        constituentJobIds
      }, notes);
      
      if (success) {
        await fetchJobStages();
        await updateJobStatusToCurrentStage();
      }
      
      return success;
    } else {
      const success = await completeStage(stageId, notes);
      
      if (success) {
        await fetchJobStages();
        await updateJobStatusToCurrentStage();
      }
      
      return success;
    }
  }, [batchAwareActions, completeStage, isBatchMaster, job, jobId, jobTableName, batchName, constituentJobIds, fetchJobStages]);

  // Send stage back for rework with batch awareness
  const sendBackForRework = useCallback(async (
    currentStageId: string, 
    targetStageId: string, 
    reworkReason?: string
  ) => {
    if (isBatchMaster || job?.batch_ready) {
      const success = await batchAwareActions.reworkStage(
        currentStageId,
        targetStageId,
        {
          jobId,
          jobTableName,
          isBatchMaster,
          batchName,
          constituentJobIds
        },
        reworkReason
      );
      
      if (success) {
        await fetchJobStages();
        await updateJobStatusToCurrentStage();
      }
      
      return success;
    } else {
      const success = await reworkStage(
        jobId, 
        jobTableName, 
        currentStageId, 
        targetStageId, 
        reworkReason
      );
      
      if (success) {
        await fetchJobStages();
        await updateJobStatusToCurrentStage();
      }
      
      return success;
    }
  }, [batchAwareActions, reworkStage, isBatchMaster, job, jobId, jobTableName, batchName, constituentJobIds, fetchJobStages]);

  // Update job status to reflect current stage state
  const updateJobStatusToCurrentStage = useCallback(async () => {
    try {
      const activeStage = jobStages.find(stage => stage.status === 'active');
      const nextPendingStage = jobStages.find(stage => stage.status === 'pending');
      const allCompleted = jobStages.length > 0 && jobStages.every(stage => stage.status === 'completed');
      
      let newStatus = 'queued';
      
      if (allCompleted) {
        newStatus = 'completed';
      } else if (activeStage) {
        // Currently working on this stage
        newStatus = activeStage.production_stage.name;
      } else if (nextPendingStage) {
        // Waiting to start the next stage
        newStatus = `Ready for ${nextPendingStage.production_stage.name}`;
      } else if (jobStages.length > 0) {
        // If no active or pending stages, something is wrong
        newStatus = 'pending';
      }

      console.log('🔄 Updating job status to:', newStatus);

      const { error } = await supabase
        .from(jobTableName as any)
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) {
        console.error('❌ Error updating job status:', error);
        throw error;
      }

      console.log('✅ Job status updated successfully');
    } catch (err) {
      console.error('❌ Error updating job status:', err);
    }
  }, [jobStages, jobId, jobTableName]);

  // Get available stages for rework (uses validation logic)
  const getAvailableReworkStages = useCallback((currentStageId: string) => {
    return validation.getAvailableReworkStages(currentStageId);
  }, [validation]);

  // Get workflow progress
  const getWorkflowProgress = useCallback(() => {
    if (jobStages.length === 0) return { completed: 0, total: 0, percentage: 0 };
    
    const completed = jobStages.filter(stage => stage.status === 'completed').length;
    const total = jobStages.length;
    const percentage = Math.round((completed / total) * 100);
    
    return { completed, total, percentage };
  }, [jobStages]);

  // Load rework history
  const loadReworkHistory = useCallback(async () => {
    return await fetchReworkHistory(jobId, jobTableName);
  }, [fetchReworkHistory, jobId, jobTableName]);

  // Memoized refresh function to prevent re-renders
  const refreshStages = useCallback(() => {
    return fetchJobStages();
  }, [fetchJobStages]);

  return {
    // State
    jobStages,
    isLoading,
    error,
    isProcessing,
    isReworking,
    reworkHistory,
    
    // Actions
    initializeJobWorkflow,
    startStage: startStageEnhanced,
    completeStage: completeStageEnhanced,
    sendBackForRework,
    
    // Helpers (using batch-aware validation when applicable)
    getCurrentStage: validation.getCurrentStage,
    getNextStage: validation.getNextStage,
    getAvailableReworkStages,
    canStartStage: validation.canStartStage,
    canAdvanceStage: validation.canAdvanceStage,
    canReworkStage: validation.canReworkStage,
    getWorkflowProgress,
    loadReworkHistory,
    refreshStages,
    
    // Batch-specific helpers (only available with batch-aware validation)
    ...((isBatchMaster || job?.batch_ready) ? {
      getBatchContext: batchValidation.getBatchContext,
      getStageDisplayInfo: batchValidation.getStageDisplayInfo
    } : {}),
    
    // Batch context
    isBatchMaster,
    batchName,
    batchAwareActions
  };
};
