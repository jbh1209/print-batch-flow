
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface StageCount {
  stage_id: string;
  stage_name: string;
  stage_color: string;
  active_jobs: number;
  pending_jobs: number;
  total_jobs: number;
}

export const useProductionStageCounts = () => {
  const [stageCounts, setStageCounts] = useState<StageCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStageCounts = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);

      // Get all production stages
      const { data: stages, error: stagesError } = await supabase
        .from('production_stages')
        .select('id, name, color')
        .eq('is_active', true)
        .order('order_index');

      if (stagesError) throw stagesError;

      // Get job stage instances with counts - ONLY for jobs with active workflows
      const { data: jobStages, error: jobStagesError } = await supabase
        .from('job_stage_instances')
        .select(`
          production_stage_id,
          status,
          job_id,
          production_stages!inner(id, name, color)
        `)
        .eq('job_table_name', 'production_jobs')
        .in('status', ['active', 'pending']);

      if (jobStagesError) throw jobStagesError;

      // Filter to ensure we only count jobs that have at least one active/pending stage
      // (This ensures we're not counting stages from completed jobs)
      const activeJobIds = [...new Set(jobStages?.map(js => js.job_id) || [])];
      
      const filteredJobStages = jobStages?.filter(js => 
        activeJobIds.includes(js.job_id)
      ) || [];

      // Count jobs per stage
      const counts = stages.map(stage => {
        const stageJobs = filteredJobStages.filter(js => js.production_stage_id === stage.id);
        const activeJobs = stageJobs.filter(js => js.status === 'active').length;
        const pendingJobs = stageJobs.filter(js => js.status === 'pending').length;

        return {
          stage_id: stage.id,
          stage_name: stage.name,
          stage_color: stage.color,
          active_jobs: activeJobs,
          pending_jobs: pendingJobs,
          total_jobs: activeJobs + pendingJobs
        };
      });

      setStageCounts(counts);
    } catch (err) {
      console.error('Error fetching stage counts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load stage counts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStageCounts();
  }, [fetchStageCounts]);

  return {
    stageCounts,
    isLoading,
    error,
    refreshCounts: fetchStageCounts
  };
};
