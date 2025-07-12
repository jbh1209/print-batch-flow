import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CoverTextStageActionOptions {
  jobId: string;
  stageId: string;
  partName?: string;
  dependencyGroup?: string;
  notes?: string;
}

export const useCoverTextStageActions = () => {
  const [isLoading, setIsLoading] = useState(false);

  const completeStageWithDependencyCheck = async (options: CoverTextStageActionOptions) => {
    setIsLoading(true);
    
    try {
      console.log('Completing cover/text stage with dependency check:', options);

      // Check if this stage has a dependency group that needs to be checked
      if (options.dependencyGroup) {
        const { data: dependencyComplete, error: depError } = await supabase.rpc('check_dependency_completion', {
          p_job_id: options.jobId,
          p_job_table_name: 'production_jobs',
          p_dependency_group: options.dependencyGroup
        });

        if (depError) {
          throw new Error(`Failed to check dependencies: ${depError.message}`);
        }

        if (!dependencyComplete) {
          // Mark this stage as completed but don't advance yet
          await supabase
            .from('job_stage_instances')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              completed_by: (await supabase.auth.getUser()).data.user?.id,
              notes: options.notes || null
            })
            .eq('job_id', options.jobId)
            .eq('production_stage_id', options.stageId);

          toast.success(`${options.partName || 'Stage'} completed. Waiting for other components to finish.`);
          return { success: true, waiting: true };
        }
      }

      // Use standard advancement - dependencies are complete or no dependencies
      const { error } = await supabase.rpc('advance_job_stage', {
        p_job_id: options.jobId,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: options.stageId,
        p_notes: options.notes || null
      });

      if (error) {
        throw new Error(`Failed to advance stage: ${error.message}`);
      }

      toast.success(`${options.partName || 'Stage'} completed and workflow advanced`);
      return { success: true, waiting: false };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error completing cover/text stage:', error);
      toast.error(`Failed to complete stage: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const checkDependencyStatus = async (jobId: string, dependencyGroup: string) => {
    try {
      const { data, error } = await supabase.rpc('check_dependency_completion', {
        p_job_id: jobId,
        p_job_table_name: 'production_jobs',
        p_dependency_group: dependencyGroup
      });

      if (error) {
        throw new Error(`Failed to check dependency status: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error checking dependency status:', error);
      return false;
    }
  };

  return {
    completeStageWithDependencyCheck,
    checkDependencyStatus,
    isLoading
  };
};