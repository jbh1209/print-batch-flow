import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { setProperJobOrderInStage } from "@/utils/tracker/jobOrderingService";
import { verifyJobStagesArePending, checkExistingStages } from "@/utils/tracker/workflowVerificationService";

export const useWorkflowInitializationCore = () => {
  const [isInitializing, setIsInitializing] = useState(false);

  const initializeStandardWorkflow = async (
    jobId: string,
    jobTableName: string,
    categoryId: string
  ): Promise<boolean> => {
    try {
      console.log('🔄 Initializing standard workflow - sequential stages only...', { jobId, jobTableName, categoryId });

      const hasExisting = await checkExistingStages(jobId, jobTableName);
      if (hasExisting) {
        console.log('⚠️ Workflow already exists for this job');
        toast.info('Workflow already exists for this job');
        return true;
      }

      const { error } = await supabase.rpc('initialize_job_stages', {
        p_job_id: jobId,
        p_job_table_name: jobTableName,
        p_category_id: categoryId
      });

      if (error) {
        console.error('❌ Database error during workflow initialization:', error);
        throw new Error(`Failed to initialize workflow: ${error.message}`);
      }

      console.log('✅ Workflow initialized successfully');
      await setProperJobOrderInStage(jobId, jobTableName);
      
      const isValid = await verifyJobStagesArePending(jobId, jobTableName);
      if (isValid) {
        toast.success('Sequential workflow initialized successfully');
      }
      
      return isValid;
    } catch (err) {
      console.error('❌ Error initializing workflow:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize workflow';
      toast.error(errorMessage);
      return false;
    }
  };

  const initializeCustomWorkflow = async (
    jobId: string,
    jobTableName: string,
    stageIds: string[],
    stageOrders: number[]
  ): Promise<boolean> => {
    try {
      console.log('🔄 Initializing custom workflow...', { 
        jobId, jobTableName, stageIds, stageOrders 
      });

      const hasExisting = await checkExistingStages(jobId, jobTableName);
      if (hasExisting) {
        console.log('⚠️ Workflow already exists for this job');
        toast.info('Workflow already exists for this job');
        return true;
      }

      const { error } = await supabase.rpc('initialize_custom_job_stages', {
        p_job_id: jobId,
        p_job_table_name: jobTableName,
        p_stage_ids: stageIds,
        p_stage_orders: stageOrders
      });

      if (error) {
        console.error('❌ Database error during custom workflow initialization:', error);
        throw new Error(`Failed to initialize custom workflow: ${error.message}`);
      }

      console.log('✅ Custom workflow initialized successfully');
      await setProperJobOrderInStage(jobId, jobTableName);
      
      const isValid = await verifyJobStagesArePending(jobId, jobTableName);
      if (isValid) {
        toast.success('Custom workflow initialized successfully');
      }
      
      return isValid;
    } catch (err) {
      console.error('❌ Error initializing custom workflow:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize workflow';
      toast.error(errorMessage);
      return false;
    }
  };

  return {
    initializeStandardWorkflow,
    initializeCustomWorkflow,
    isInitializing,
    setIsInitializing
  };
};