
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useWorkflowInitialization = () => {
  const [isInitializing, setIsInitializing] = useState(false);

  const initializeWorkflow = async (jobId: string, jobTableName: string, categoryId: string) => {
    try {
      setIsInitializing(true);
      console.log('🔄 Initializing workflow...', { jobId, jobTableName, categoryId });

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

      // Get production stages for the category using the correct table relationship
      const { data: categoryStages, error: stagesError } = await supabase
        .from('category_production_stages')
        .select(`
          stage_order,
          estimated_duration_hours,
          production_stage:production_stages(
            id,
            name,
            color
          )
        `)
        .eq('category_id', categoryId)
        .eq('is_required', true)
        .order('stage_order');

      if (stagesError) throw stagesError;

      if (!categoryStages || categoryStages.length === 0) {
        throw new Error('No production stages found for this category');
      }

      // Create job stage instances
      const stageInstances = categoryStages.map((cs, index) => ({
        job_id: jobId,
        job_table_name: jobTableName,
        category_id: categoryId,
        production_stage_id: cs.production_stage.id,
        stage_order: cs.stage_order,
        status: index === 0 ? 'active' : 'pending', // First stage is active
        started_at: index === 0 ? new Date().toISOString() : null
      }));

      const { error: insertError } = await supabase
        .from('job_stage_instances')
        .insert(stageInstances);

      if (insertError) throw insertError;

      console.log('✅ Workflow initialized successfully');
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
