
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useWorkflowInitialization = () => {
  const [isInitializing, setIsInitializing] = useState(false);

  const initializeWorkflow = async (jobId: string, jobTableName: string, categoryId: string) => {
    try {
      setIsInitializing(true);
      console.log('🔄 Initializing workflow with multi-part support...', { jobId, jobTableName, categoryId });

      // First, check if workflow already exists
      const { data: existingStages, error: checkError } = await supabase
        .from('job_stage_instances')
        .select('id')
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName);

      if (checkError) throw checkError;

      if (existingStages && existingStages.length > 0) {
        toast.info('Workflow already initialized for this job');
        return true;
      }

      // Use the new multi-part initialization function
      const { data, error } = await supabase.rpc('initialize_job_stages_with_parts', {
        p_job_id: jobId,
        p_job_table_name: jobTableName,
        p_category_id: categoryId
      });

      if (error) throw error;

      console.log('✅ Workflow initialized successfully with multi-part support');
      toast.success('Production workflow initialized successfully');
      return true;
    } catch (err) {
      console.error('❌ Error initializing workflow:', err);
      toast.error('Failed to initialize workflow');
      return false;
    } finally {
      setIsInitializing(false);
    }
  };

  return {
    initializeWorkflow,
    isInitializing
  };
};
