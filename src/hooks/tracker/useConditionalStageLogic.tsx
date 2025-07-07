import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ConditionalStage {
  id: string;
  name: string;
  category_id?: string;
}

export const useConditionalStageLogic = () => {
  const [conditionalStages, setConditionalStages] = useState<ConditionalStage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchConditionalStages = useCallback(async (categoryId?: string) => {
    try {
      setIsLoading(true);
      
      let query = supabase
        .from('production_stages')
        .select(`
          id,
          name
        `)
        .eq('is_active', true);

      const { data, error } = await query;
      
      if (error) throw error;
      
      const mappedStages = (data || []).map(stage => ({
        id: stage.id,
        name: stage.name,
        category_id: categoryId
      }));
      
      setConditionalStages(mappedStages);
    } catch (error) {
      console.error('❌ Error fetching stages:', error);
      toast.error("Failed to load stages");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const shouldShowBatchAllocationStage = useCallback(async (jobId: string, categoryId: string): Promise<boolean> => {
    try {
      // Check if the job's category has batch allocation stage configured
      const { data: categoryStage } = await supabase
        .from('category_production_stages')
        .select(`
          production_stages!inner(
            name
          )
        `)
        .eq('category_id', categoryId)
        .eq('production_stages.name', 'Batch Allocation')
        .single();

      if (!categoryStage) {
        console.log('🔍 No batch allocation stage found for category');
        return false;
      }

      // Check if the job has any pending batch jobs
      const { data: batchJobs } = await supabase
        .from('batch_job_references')
        .select('id')
        .eq('production_job_id', jobId)
        .eq('status', 'pending')
        .limit(1);

      // Show stage if no pending batch jobs exist (job needs allocation)
      const shouldShow = !batchJobs || batchJobs.length === 0;
      
      console.log('🔍 Batch allocation stage visibility:', {
        jobId,
        categoryId,
        shouldShow,
        existingBatchJobs: batchJobs?.length || 0
      });

      return shouldShow;
    } catch (error) {
      console.error('❌ Error checking batch allocation stage visibility:', error);
      return false;
    }
  }, []);

  const markJobReadyForBatching = useCallback(async (jobId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.rpc('mark_job_ready_for_batching', {
        p_job_id: jobId,
        p_job_table_name: 'production_jobs'
      });

      if (error) throw error;

      console.log('✅ Job marked ready for batching:', jobId);
      toast.success("Job marked ready for batching");
      return true;
    } catch (error) {
      console.error('❌ Error marking job ready for batching:', error);
      toast.error("Failed to mark job ready for batching");
      return false;
    }
  }, []);

  const skipConditionalStage = useCallback(async (
    jobId: string, 
    stageId: string, 
    reason: string = 'Stage skipped'
  ): Promise<boolean> => {
    try {
      const { error } = await supabase.rpc('advance_job_stage', {
        p_job_id: jobId,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: stageId,
        p_notes: `Stage skipped: ${reason}`
      });

      if (error) throw error;

      console.log('✅ Stage skipped:', { jobId, stageId, reason });
      toast.success("Stage skipped successfully");
      return true;
    } catch (error) {
      console.error('❌ Error skipping stage:', error);
      toast.error("Failed to skip stage");
      return false;
    }
  }, []);

  const activateConditionalStage = useCallback(async (
    jobId: string,
    stageId: string
  ): Promise<boolean> => {
    try {
      // Update the stage instance to active
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'active',
          started_at: new Date().toISOString()
        })
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .eq('production_stage_id', stageId)
        .eq('status', 'pending');

      if (error) throw error;

      console.log('✅ Stage activated:', { jobId, stageId });
      return true;
    } catch (error) {
      console.error('❌ Error activating stage:', error);
      return false;
    }
  }, []);

  const getBatchAllocationStatus = useCallback(async (jobId: string): Promise<{
    needsBatching: boolean;
    batchReady: boolean;
    batchJobsCount: number;
  }> => {
    try {
      // Check if job is marked as batch ready
      const { data: job } = await supabase
        .from('production_jobs')
        .select('batch_ready')
        .eq('id', jobId)
        .single();

      // Check existing batch job references
      const { data: batchRefs } = await supabase
        .from('batch_job_references')
        .select('id, status')
        .eq('production_job_id', jobId);

      const batchJobsCount = batchRefs?.length || 0;
      const batchReady = job?.batch_ready || false;
      const needsBatching = !batchReady && batchJobsCount === 0;

      return {
        needsBatching,
        batchReady,
        batchJobsCount
      };
    } catch (error) {
      console.error('❌ Error getting batch allocation status:', error);
      return {
        needsBatching: false,
        batchReady: false,
        batchJobsCount: 0
      };
    }
  }, []);

  return {
    conditionalStages,
    isLoading,
    fetchConditionalStages,
    shouldShowBatchAllocationStage,
    markJobReadyForBatching,
    skipConditionalStage,
    activateConditionalStage,
    getBatchAllocationStatus
  };
};