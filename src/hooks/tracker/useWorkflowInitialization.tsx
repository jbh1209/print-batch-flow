
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useWorkflowInitialization = () => {
  const [isInitializing, setIsInitializing] = useState(false);

  const initializeWorkflow = async (jobId: string, jobTableName: string, categoryId: string) => {
    try {
      setIsInitializing(true);
      console.log('🔄 Initializing workflow...', { jobId, jobTableName, categoryId });

      // Use the database function to initialize workflow - it handles all cleanup and creation
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

      // Use the enhanced function for multi-part categories - it handles all cleanup and creation
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

      // Use the standard initialization function - it handles cleanup automatically
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
