
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
      console.log('🔄 Initializing standard workflow - ALL STAGES WILL BE PENDING...', { jobId, jobTableName, categoryId });

      const hasExisting = await checkExistingStages(jobId, jobTableName);
      if (hasExisting) {
        console.log('⚠️ Workflow already exists for this job');
        toast.info('Workflow already exists for this job');
        return true;
      }

      const { error } = await supabase.rpc('initialize_job_stages_auto', {
        p_job_id: jobId,
        p_job_table_name: jobTableName,
        p_category_id: categoryId
      });

      if (error) {
        console.error('❌ Database error during workflow initialization:', error);
        throw new Error(`Failed to initialize workflow: ${error.message}`);
      }

      console.log('✅ Workflow initialized successfully - SETTING PROPER JOB ORDER...');
      await setProperJobOrderInStage(jobId, jobTableName);
      
      const isValid = await verifyJobStagesArePending(jobId, jobTableName);
      if (isValid) {
        toast.success('Production workflow initialized successfully - all stages are PENDING and await operator action');
      }
      
      return isValid;
    } catch (err) {
      console.error('❌ Error initializing workflow:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize workflow';
      toast.error(errorMessage);
      return false;
    }
  };

  const initializeMultiPartWorkflow = async (
    jobId: string,
    jobTableName: string,
    categoryId: string,
    partAssignments?: Record<string, string>
  ): Promise<boolean> => {
    try {
      console.log('🔄 Initializing workflow with part assignments - ALL STAGES WILL BE PENDING...', { 
        jobId, jobTableName, categoryId, partAssignments 
      });

      const hasExisting = await checkExistingStages(jobId, jobTableName);
      if (hasExisting) {
        console.log('⚠️ Workflow already exists for this job');
        toast.info('Workflow already exists for this job');
        return true;
      }

      const { error } = await supabase.rpc('initialize_job_stages_with_part_assignments', {
        p_job_id: jobId,
        p_job_table_name: jobTableName,
        p_category_id: categoryId,
        p_part_assignments: partAssignments || null
      });

      if (error) {
        console.error('❌ Database error during part-aware workflow initialization:', error);
        throw new Error(`Failed to initialize workflow with part assignments: ${error.message}`);
      }

      console.log('✅ Multi-part workflow initialized successfully - SETTING PROPER JOB ORDER...');
      await setProperJobOrderInStage(jobId, jobTableName);
      
      const isValid = await verifyJobStagesArePending(jobId, jobTableName);
      if (isValid) {
        toast.success('Multi-part workflow initialized successfully - all stages are PENDING and await operator action');
      }
      
      return isValid;
    } catch (err) {
      console.error('❌ Error initializing multi-part workflow:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize workflow';
      toast.error(errorMessage);
      return false;
    }
  };

  return {
    initializeStandardWorkflow,
    initializeMultiPartWorkflow,
    isInitializing,
    setIsInitializing
  };
};
