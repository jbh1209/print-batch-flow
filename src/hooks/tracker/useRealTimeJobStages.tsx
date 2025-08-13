import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fetchJobStagesFromSupabase } from "./useRealTimeJobStages/fetchJobStages";
import { useJobStageSubscription } from "./useRealTimeJobStages/useJobStageSubscription";
import { JobStageWithDetails } from "./useRealTimeJobStages/types";

export const useRealTimeJobStages = (jobs: any[] = []) => {
  const [jobStages, setJobStages] = useState<JobStageWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchJobStages = useCallback(async () => {
    if (jobs.length === 0) {
      setJobStages([]);
      setIsLoading(false);
      return;
    }
    try {
      setError(null);
      setIsLoading(true);
      const enrichedStages = await fetchJobStagesFromSupabase(jobs);
      setJobStages(enrichedStages);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job stages');
    } finally {
      setIsLoading(false);
    }
  }, [jobs]);

  // Initial fetch
  useEffect(() => {
    fetchJobStages();
  }, [fetchJobStages]);

  // Real-time subscription (logic moved to hook)
  useJobStageSubscription(jobs, fetchJobStages);

  // --- Actions (no changes) ---
  const startStage = useCallback(async (stageId: string) => {
    try {
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', stageId)
        .eq('status', 'pending');

      if (error) throw error;
      toast.success('Stage started successfully');
      return true;
    } catch (err) {
      toast.error('Failed to start stage');
      return false;
    }
  }, []);

  const completeStage = useCallback(
    async (stageId: string, notes?: string) => {
      try {
        const stage = jobStages.find((s) => s.id === stageId);
        if (!stage) throw new Error('Stage not found');

        const { data, error } = await supabase.rpc('advance_job_stage', {
          p_job_id: stage.job_id,
          p_job_table_name: stage.job_table_name,
          p_current_stage_id: stageId,
          p_notes: notes || null,
        });

        if (error) throw error;
        if (!data) throw new Error('Failed to advance stage');

        toast.success('Stage completed successfully');
        return true;
      } catch (err) {
        toast.error('Failed to complete stage');
        return false;
      }
    },
    [jobStages]
  );

  // --- Analytics and metrics ---
  const getStageMetrics = useCallback(() => {
    const totalStages = jobStages.length;
    const activeStages = jobStages.filter((s) => s.status === 'active').length;
    const pendingStages = jobStages.filter((s) => s.status === 'pending').length;
    const completedStages = jobStages.filter((s) => s.status === 'completed').length;
    const uniqueJobs = new Set(jobStages.map((s) => s.job_id)).size;

    return {
      totalStages,
      activeStages,
      pendingStages,
      completedStages,
      uniqueJobs,
    };
  }, [jobStages]);

  const getStagesByProductionStage = useCallback(
    (productionStageId: string) => {
      return jobStages.filter((s) => s.production_stage_id === productionStageId);
    },
    [jobStages]
  );

  const getActiveStagesForJob = useCallback(
    (jobId: string) => {
      return jobStages.filter((s) => s.job_id === jobId && s.status === 'active');
    },
    [jobStages]
  );

  return {
    jobStages,
    isLoading,
    error,
    lastUpdate,

    // Actions
    startStage,
    completeStage,
    refreshStages: fetchJobStages,

    // Analytics
    getStageMetrics,
    getStagesByProductionStage,
    getActiveStagesForJob,
  };
};
