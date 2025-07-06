import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useConcurrentStageOperations = () => {
  
  // Start concurrent printing stages (covers + text simultaneously)
  const startConcurrentPrintingStages = useCallback(async (
    jobId: string, 
    jobTableName: string, 
    stageIds: string[]
  ) => {
    try {
      console.log('🔄 Starting concurrent printing stages...', { jobId, stageIds });
      
      const { data, error } = await supabase.rpc('start_concurrent_printing_stages', {
        p_job_id: jobId,
        p_job_table_name: jobTableName,
        p_stage_ids: stageIds
      });

      if (error) {
        console.error('❌ Error starting concurrent stages:', error);
        throw error;
      }

      console.log('✅ Concurrent printing stages started successfully');
      toast.success("Started printing on multiple machines");
      return true;
    } catch (err) {
      console.error('❌ Error starting concurrent stages:', err);
      toast.error("Failed to start concurrent printing");
      return false;
    }
  }, []);

  // Complete stage with part-specific chain handling
  const completeStageWithPartChain = useCallback(async (
    jobId: string,
    jobTableName: string,
    stageId: string,
    notes?: string
  ) => {
    try {
      console.log('🔄 Completing stage with part chain handling...', { jobId, stageId });
      
      const { data, error } = await supabase.rpc('advance_job_stage_with_parts', {
        p_job_id: jobId,
        p_job_table_name: jobTableName,
        p_current_stage_id: stageId,
        p_notes: notes
      });

      if (error) {
        console.error('❌ Error completing stage with part chain:', error);
        throw error;
      }

      console.log('✅ Stage completed with part chain handling');
      toast.success("Stage completed - checking dependencies");
      return true;
    } catch (err) {
      console.error('❌ Error completing stage with part chain:', err);
      toast.error("Failed to complete stage");
      return false;
    }
  }, []);

  // Check if dependency group is complete
  const checkDependencyCompletion = useCallback(async (
    jobId: string,
    jobTableName: string,
    dependencyGroup: string
  ) => {
    try {
      const { data, error } = await supabase.rpc('check_dependency_completion', {
        p_job_id: jobId,
        p_job_table_name: jobTableName,
        p_dependency_group: dependencyGroup
      });

      if (error) {
        console.error('❌ Error checking dependency completion:', error);
        return false;
      }

      return data === true;
    } catch (err) {
      console.error('❌ Error checking dependency completion:', err);
      return false;
    }
  }, []);

  // Get concurrent stage groups for a job
  const getConcurrentStageGroups = useCallback(async (jobId: string) => {
    try {
      const { data, error } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          production_stage_id,
          part_name,
          status,
          concurrent_stage_group_id,
          allows_concurrent_start,
          production_stage:production_stages(name, color)
        `)
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .not('concurrent_stage_group_id', 'is', null);

      if (error) throw error;

      // Group by concurrent_stage_group_id
      const groups: Record<string, any[]> = {};
      data?.forEach(stage => {
        if (stage.concurrent_stage_group_id) {
          if (!groups[stage.concurrent_stage_group_id]) {
            groups[stage.concurrent_stage_group_id] = [];
          }
          groups[stage.concurrent_stage_group_id].push(stage);
        }
      });

      return groups;
    } catch (err) {
      console.error('❌ Error getting concurrent stage groups:', err);
      return {};
    }
  }, []);

  // Check if all parts in a concurrent group can start
  const canStartConcurrentGroup = useCallback(async (
    jobId: string,
    concurrentGroupId: string
  ) => {
    try {
      const { data, error } = await supabase
        .from('job_stage_instances')
        .select('status')
        .eq('job_id', jobId)
        .eq('concurrent_stage_group_id', concurrentGroupId);

      if (error) throw error;

      // All stages in group should be pending to start concurrently
      return data?.every(stage => stage.status === 'pending') ?? false;
    } catch (err) {
      console.error('❌ Error checking concurrent group start capability:', err);
      return false;
    }
  }, []);

  return {
    startConcurrentPrintingStages,
    completeStageWithPartChain,
    checkDependencyCompletion,
    getConcurrentStageGroups,
    canStartConcurrentGroup
  };
};