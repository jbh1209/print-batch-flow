
import { useWorkflowInitializationCore } from "./useWorkflowInitializationCore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { setProperJobOrderInStage } from "@/utils/tracker/jobOrderingService";
import { verifyJobStagesArePending } from "@/utils/tracker/workflowVerificationService";

export const useWorkflowInitialization = () => {
  const { 
    initializeStandardWorkflow,
    initializeCustomWorkflow,
    isInitializing,
    setIsInitializing
  } = useWorkflowInitializationCore();

  const initializeWorkflow = async (jobId: string, jobTableName: string, categoryId: string) => {
    setIsInitializing(true);
    try {
      return await initializeStandardWorkflow(jobId, jobTableName, categoryId);
    } finally {
      setIsInitializing(false);
    }
  };

  const initializeCustomWorkflowWithStages = async (
    jobId: string, 
    jobTableName: string, 
    stageIds: string[], 
    stageOrders: number[]
  ) => {
    setIsInitializing(true);
    try {
      return await initializeCustomWorkflow(jobId, jobTableName, stageIds, stageOrders);
    } finally {
      setIsInitializing(false);
    }
  };

  const repairJobWorkflow = async (jobId: string, jobTableName: string, categoryId: string) => {
    try {
      setIsInitializing(true);
      console.log('🔧 Repairing job workflow - ALL STAGES WILL BE PENDING...', { jobId, jobTableName, categoryId });

      // Delete any existing orphaned stages first
      const { error: deleteError } = await supabase
        .from('job_stage_instances')
        .delete()
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName);

      if (deleteError) {
        console.error('❌ Error cleaning up existing stages:', deleteError);
      }

      const success = await initializeStandardWorkflow(jobId, jobTableName, categoryId);
      return success;
    } catch (err) {
      console.error('❌ Error repairing workflow:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to repair workflow';
      toast.error(errorMessage);
      return false;
    } finally {
      setIsInitializing(false);
    }
  };

  return {
    initializeWorkflow,
    initializeCustomWorkflowWithStages,
    repairJobWorkflow,
    isInitializing
  };
};
