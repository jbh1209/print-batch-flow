
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

      // Get job stage instances with counts - ONLY active stages (jobs currently IN each stage)
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

      // Count jobs per stage - ACTIVE means currently IN that stage, PENDING means waiting for that stage
      const counts = stages.map(stage => {
        const stageJobs = jobStages?.filter(js => js.production_stage_id === stage.id) || [];
        const activeJobs = stageJobs.filter(js => js.status === 'active').length;
        const pendingJobs = stageJobs.filter(js => js.status === 'pending').length;

        return {
          stage_id: stage.id,
          stage_name: stage.name,
          stage_color: stage.color,
          active_jobs: activeJobs, // Jobs currently IN this stage
          pending_jobs: pendingJobs, // Jobs waiting for this stage
          total_jobs: activeJobs + pendingJobs
        };
      });

      console.log('Stage counts calculated:', counts);
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
