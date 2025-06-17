
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useWorkflowInitialization = () => {
  const [isInitializing, setIsInitializing] = useState(false);

  const checkExistingStages = async (jobId: string, jobTableName: string): Promise<boolean> => {
    try {
      const { data: existingStages, error } = await supabase
        .from('job_stage_instances')
        .select('id')
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName)
        .limit(1);

      if (error) {
        console.error('Error checking existing stages:', error);
        return false;
      }

      return existingStages && existingStages.length > 0;
    } catch (error) {
      console.error('Error in checkExistingStages:', error);
      return false;
    }
  };

  const initializeWorkflow = async (jobId: string, jobTableName: string, categoryId: string) => {
    try {
      setIsInitializing(true);
      console.log('🔄 Initializing workflow...', { jobId, jobTableName, categoryId });

      // Check if workflow already exists
      const hasExisting = await checkExistingStages(jobId, jobTableName);
      if (hasExisting) {
        console.log('⚠️ Workflow already exists for this job');
        toast.info('Workflow already exists for this job');
        return true; // Return true since the job does have a workflow
      }

      // Use the database function to initialize workflow
      const { error } = await supabase.rpc('initialize_job_stages_auto', {
        p_job_id: jobId,
        p_job_table_name: jobTableName,
        p_category_id: categoryId
      });

      if (error) {
        console.error('❌ Database error during workflow initialization:', error);
        throw new Error(`Failed to initialize workflow: ${error.message}`);
      }

      console.log('✅ Workflow initialized successfully');
      toast.success('Production workflow initialized successfully');
      return true;
    } catch (err) {
      console.error('❌ Error initializing workflow:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize workflow';
      toast.error(errorMessage);
      return false;
    } finally {
      setIsInitializing(false);
    }
  };

  const initializeWorkflowWithPartAssignments = async (
    jobId: string, 
    jobTableName: string, 
    categoryId: string, 
    partAssignments?: Record<string, string>
  ) => {
    try {
      setIsInitializing(true);
      console.log('🔄 Initializing workflow with part assignments...', { 
        jobId, 
        jobTableName, 
        categoryId, 
        partAssignments 
      });

      // Check if workflow already exists
      const hasExisting = await checkExistingStages(jobId, jobTableName);
      if (hasExisting) {
        console.log('⚠️ Workflow already exists for this job');
        toast.info('Workflow already exists for this job');
        return true; // Return true since the job does have a workflow
      }

      // Use the enhanced function for multi-part categories
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

      console.log('✅ Multi-part workflow initialized successfully');
      toast.success('Multi-part workflow initialized successfully');
      return true;
    } catch (err) {
      console.error('❌ Error initializing multi-part workflow:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize workflow';
      toast.error(errorMessage);
      return false;
    } finally {
      setIsInitializing(false);
    }
  };

  const repairJobWorkflow = async (jobId: string, jobTableName: string, categoryId: string) => {
    try {
      setIsInitializing(true);
      console.log('🔧 Repairing job workflow...', { jobId, jobTableName, categoryId });

      // Delete any existing orphaned stages first
      const { error: deleteError } = await supabase
        .from('job_stage_instances')
        .delete()
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName);

      if (deleteError) {
        console.error('❌ Error cleaning up existing stages:', deleteError);
        // Don't throw here, just log and continue
      }

      // Initialize fresh workflow
      const { error } = await supabase.rpc('initialize_job_stages_auto', {
        p_job_id: jobId,
        p_job_table_name: jobTableName,
        p_category_id: categoryId
      });

      if (error) {
        console.error('❌ Database error during workflow repair:', error);
        throw new Error(`Failed to repair workflow: ${error.message}`);
      }

      console.log('✅ Job workflow repaired successfully');
      return true;
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
    initializeWorkflowWithPartAssignments,
    repairJobWorkflow,
    isInitializing
  };
};
