
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useWorkflowInitialization = () => {
  const [isInitializing, setIsInitializing] = useState(false);

  const initializeWorkflow = async (jobId: string, jobTableName: string, categoryId: string) => {
    try {
      setIsInitializing(true);
      console.log('🔄 Initializing workflow with proper error handling...', { jobId, jobTableName, categoryId });

      // First, check if workflow already exists
      const { data: existingStages, error: checkError } = await supabase
        .from('job_stage_instances')
        .select('id')
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName);

      if (checkError) throw checkError;

      if (existingStages && existingStages.length > 0) {
        console.log('ℹ️ Workflow already exists, skipping initialization');
        toast.info('Workflow already initialized for this job');
        return true;
      }

      // Use the standard initialization function for consistent behavior
      const { data, error } = await supabase.rpc('initialize_job_stages_auto', {
        p_job_id: jobId,
        p_job_table_name: jobTableName,
        p_category_id: categoryId
      });

      if (error) {
        console.error('❌ Database error during workflow initialization:', error);
        throw new Error(`Failed to initialize workflow: ${error.message}`);
      }

      // Verify stages were created
      const { data: createdStages, error: verifyError } = await supabase
        .from('job_stage_instances')
        .select('id, production_stage:production_stages(name)')
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName);

      if (verifyError) {
        console.error('❌ Error verifying created stages:', verifyError);
        throw new Error('Failed to verify workflow creation');
      }

      if (!createdStages || createdStages.length === 0) {
        console.error('❌ No stages were created during initialization');
        throw new Error('No workflow stages were created. Please check the category configuration.');
      }

      console.log('✅ Workflow initialized successfully with stages:', createdStages.length);
      toast.success(`Production workflow initialized with ${createdStages.length} stages`);
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
      const { data: existingStages, error: checkError } = await supabase
        .from('job_stage_instances')
        .select('id')
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName);

      if (checkError) throw checkError;

      if (existingStages && existingStages.length > 0) {
        console.log('ℹ️ Workflow already exists, skipping initialization');
        toast.info('Workflow already initialized for this job');
        return true;
      }

      // Use the enhanced function for multi-part categories
      const { data, error } = await supabase.rpc('initialize_job_stages_with_part_assignments', {
        p_job_id: jobId,
        p_job_table_name: jobTableName,
        p_category_id: categoryId,
        p_part_assignments: partAssignments ? JSON.stringify(partAssignments) : null
      });

      if (error) {
        console.error('❌ Database error during part-aware workflow initialization:', error);
        throw new Error(`Failed to initialize workflow with part assignments: ${error.message}`);
      }

      // Verify stages were created
      const { data: createdStages, error: verifyError } = await supabase
        .from('job_stage_instances')
        .select('id, part_name, production_stage:production_stages(name)')
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName);

      if (verifyError) {
        console.error('❌ Error verifying created stages:', verifyError);
        throw new Error('Failed to verify workflow creation');
      }

      if (!createdStages || createdStages.length === 0) {
        console.error('❌ No stages were created during initialization');
        throw new Error('No workflow stages were created. Please check the category configuration.');
      }

      console.log('✅ Multi-part workflow initialized successfully:', createdStages.length, 'stages');
      toast.success(`Multi-part workflow initialized with ${createdStages.length} stage instances`);
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

      // Delete any existing broken stage instances
      const { error: deleteError } = await supabase
        .from('job_stage_instances')
        .delete()
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName);

      if (deleteError) {
        console.error('❌ Error cleaning up existing stages:', deleteError);
        throw new Error('Failed to clean up existing workflow stages');
      }

      // Re-initialize the workflow
      const success = await initializeWorkflow(jobId, jobTableName, categoryId);
      
      if (success) {
        toast.success('Job workflow repaired successfully');
      }
      
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
    initializeWorkflowWithPartAssignments,
    repairJobWorkflow,
    isInitializing
  };
};
