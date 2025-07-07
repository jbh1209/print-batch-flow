
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

  const initializeWorkflowWithPartSupport = async (
    jobId: string,
    jobTableName: string,
    categoryId: string,
    partAssignments?: Record<string, string>
  ): Promise<boolean> => {
    try {
      console.log('🔄 Initializing workflow with part support - checking category and stage requirements...', { 
        jobId, jobTableName, categoryId, partAssignments 
      });

      const hasExisting = await checkExistingStages(jobId, jobTableName);
      if (hasExisting) {
        console.log('⚠️ Workflow already exists for this job');
        toast.info('Workflow already exists for this job');
        return true;
      }

      // Get category info to check if it requires part assignment
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('requires_part_assignment, name')
        .eq('id', categoryId)
        .single();

      if (categoryError) {
        console.error('❌ Failed to fetch category:', categoryError);
        throw new Error(`Failed to fetch category: ${categoryError.message}`);
      }

      // Choose appropriate initialization method based on category requirements
      const shouldUsePartAssignment = category.requires_part_assignment && partAssignments && Object.keys(partAssignments).length > 0;
      
      console.log(`🔧 Category "${category.name}" requires_part_assignment: ${category.requires_part_assignment}, using part-aware initialization: ${shouldUsePartAssignment}`);

      const { error } = await supabase.rpc(
        shouldUsePartAssignment ? 'initialize_job_stages' : 'initialize_job_stages_auto',
        {
          p_job_id: jobId,
          p_job_table_name: jobTableName,
          p_category_id: categoryId
        }
      );

      if (error) {
        console.error('❌ Database error during workflow initialization:', error);
        throw new Error(`Failed to initialize workflow: ${error.message}`);
      }

      console.log('✅ Workflow initialized successfully - SETTING PROPER JOB ORDER...');
      await setProperJobOrderInStage(jobId, jobTableName);
      
      const isValid = await verifyJobStagesArePending(jobId, jobTableName);
      if (isValid) {
        const workflowType = shouldUsePartAssignment ? 'Part-aware' : 'Standard';
        toast.success(`${workflowType} workflow initialized successfully - all stages are PENDING and await operator action`);
      }
      
      return isValid;
    } catch (err) {
      console.error('❌ Error initializing workflow:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize workflow';
      toast.error(errorMessage);
      return false;
    }
  };

  return {
    initializeStandardWorkflow,
    initializeMultiPartWorkflow: initializeWorkflowWithPartSupport,
    isInitializing,
    setIsInitializing
  };
};
