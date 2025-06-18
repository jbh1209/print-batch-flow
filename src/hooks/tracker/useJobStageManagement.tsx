
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useJobStageInstances } from "./useJobStageInstances";
import { useStageRework } from "./useStageRework";
import { useStageActions } from "./stage-management/useStageActions";
import { useStageValidation } from "./stage-management/useStageValidation";

interface JobStageManagementOptions {
  jobId: string;
  jobTableName: string;
  categoryId?: string;
}

export const useJobStageManagement = ({ 
  jobId, 
  jobTableName, 
  categoryId 
}: JobStageManagementOptions) => {
  const [isProcessing, setIsProcessing] = useState(false);
  
  const {
    jobStages,
    isLoading,
    error,
    fetchJobStages,
    initializeJobStages,
    advanceJobStage,
    updateStageNotes,
    recordQRScan
  } = useJobStageInstances(jobId, jobTableName);

  const { reworkStage, fetchReworkHistory, reworkHistory, isReworking } = useStageRework();
  const { startStage, completeStage } = useStageActions();
  const {
    canStartStage,
    canAdvanceStage,
    canReworkStage,
    getCurrentStage,
    getNextStage
  } = useStageValidation(jobStages);

  // Initialize job with workflow stages based on category - ALL STAGES START AS PENDING
  const initializeJobWorkflow = useCallback(async () => {
    if (!categoryId) {
      toast.error("Category is required to initialize workflow");
      return false;
    }

    setIsProcessing(true);
    try {
      console.log('🔄 Initializing job workflow (all stages pending)...', { jobId, jobTableName, categoryId });
      
      const success = await initializeJobStages(jobId, jobTableName, categoryId);
      
      if (success) {
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
  }, [jobId, jobTableName, categoryId, initializeJobStages]);

  // Send stage back for rework
  const sendBackForRework = useCallback(async (
    currentStageId: string, 
    targetStageId: string, 
    reworkReason?: string
  ) => {
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
  }, [reworkStage, jobId, jobTableName, fetchJobStages]);

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

  // Get available stages for rework (previous stages that can be reactivated)
  const getAvailableReworkStages = useCallback((currentStageId: string) => {
    const currentStage = jobStages.find(stage => stage.production_stage_id === currentStageId);
    if (!currentStage) return [];
    
    return jobStages.filter(stage => 
      stage.stage_order < currentStage.stage_order &&
      ['completed', 'reworked'].includes(stage.status)
    );
  }, [jobStages]);

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
    startStage,
    completeStage,
    sendBackForRework,
    updateStageNotes,
    recordQRScan,
    
    // Helpers
    getCurrentStage,
    getNextStage,
    getAvailableReworkStages,
    canStartStage,
    canAdvanceStage,
    canReworkStage,
    getWorkflowProgress,
    loadReworkHistory,
    refreshStages
  };
};
