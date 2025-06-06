import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useJobStageInstances } from "./useJobStageInstances";
import { useStageRework } from "./useStageRework";

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

  // Start a stage manually (QR scan or button click)
  const startStage = useCallback(async (stageId: string, qrData?: any) => {
    setIsProcessing(true);
    try {
      console.log('🔄 Starting stage manually...', { stageId, qrData });
      
      // Record QR scan if provided
      if (qrData) {
        await recordQRScan(stageId, {
          ...qrData,
          scan_type: 'stage_start',
          scanned_at: new Date().toISOString()
        });
      }

      // Update stage to active - this is the ONLY way stages become active
      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageId)
        .eq('status', 'pending'); // Only allow starting if currently pending

      if (error) throw error;

      await fetchJobStages();
      await updateJobStatusToCurrentStage();
      toast.success("Stage started successfully");
      return true;
    } catch (err) {
      console.error('❌ Error starting stage:', err);
      toast.error("Failed to start stage");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [recordQRScan, fetchJobStages]);

  // Complete a stage - next stage remains PENDING until manually started
  const completeStage = useCallback(async (stageId: string, notes?: string, qrData?: any) => {
    setIsProcessing(true);
    try {
      console.log('🔄 Completing stage (next stage stays pending)...', { stageId, notes, qrData });
      
      // Record QR scan if provided
      if (qrData) {
        await recordQRScan(stageId, {
          ...qrData,
          scan_type: 'stage_complete',
          scanned_at: new Date().toISOString()
        });
      }

      // Complete current stage - next stage stays pending
      const success = await advanceJobStage(stageId, notes);
      
      if (success) {
        await updateJobStatusToCurrentStage();
        toast.success("Stage completed - next stage ready to start manually");
      }
      
      return success;
    } catch (err) {
      console.error('❌ Error completing stage:', err);
      toast.error("Failed to complete stage");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [advanceJobStage, recordQRScan]);

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

      // Update the job status in the respective table
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
      // Don't throw here as this is often called as a side effect
    }
  }, [jobStages, jobId, jobTableName]);

  // Get current stage info
  const getCurrentStage = useCallback(() => {
    return jobStages.find(stage => stage.status === 'active') || null;
  }, [jobStages]);

  // Get next pending stage
  const getNextStage = useCallback(() => {
    return jobStages.find(stage => stage.status === 'pending') || null;
  }, [jobStages]);

  // Get available stages for rework (previous stages that can be reactivated)
  const getAvailableReworkStages = useCallback((currentStageId: string) => {
    const currentStage = jobStages.find(stage => stage.production_stage_id === currentStageId);
    if (!currentStage) return [];
    
    return jobStages.filter(stage => 
      stage.stage_order < currentStage.stage_order &&
      ['completed', 'reworked'].includes(stage.status)
    );
  }, [jobStages]);

  // Check if stage can be started (validation rules)
  const canStartStage = useCallback((stageId: string) => {
    const stage = jobStages.find(stage => stage.id === stageId);
    if (!stage) return false;

    // Can only start if stage is currently pending
    return stage.status === 'pending';
  }, [jobStages]);

  // Check if stage can be advanced (validation rules)
  const canAdvanceStage = useCallback((stageId: string) => {
    const currentStage = jobStages.find(stage => stage.id === stageId);
    if (!currentStage) return false;

    // Can only advance if stage is currently active
    return currentStage.status === 'active';
  }, [jobStages]);

  // Check if stage can be sent back for rework
  const canReworkStage = useCallback((stageId: string) => {
    const currentStage = jobStages.find(stage => stage.id === stageId);
    if (!currentStage) return false;

    // Can only rework if stage is currently active and there are previous stages
    return currentStage.status === 'active' && 
           getAvailableReworkStages(currentStage.production_stage_id).length > 0;
  }, [jobStages, getAvailableReworkStages]);

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
    refreshStages: fetchJobStages
  };
};
