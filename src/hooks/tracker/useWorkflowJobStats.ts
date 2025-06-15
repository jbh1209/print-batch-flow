import { useMemo, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Used by Dashboard stats, pulls only real statuses
export function useWorkflowJobStats() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch real production stages from DB (no "Pre-Press" hack)
      const { data: stagesData, error: stagesError } = await supabase
        .from("production_stages")
        .select("*")
        .eq("is_active", true);

      if (stagesError) throw stagesError;
      setStages(
        (stagesData || []).map((s: any) => ({
          id: s.id,
          name: s.name, // NOTE: use s.name as canonical status match!
          color: s.stage_color || "#D1D5DB",
        }))
      );

      // Fetch all production jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from("production_jobs")
        .select("*");

      if (jobsError) throw jobsError;
      setJobs(jobsData || []);
      setIsLoading(false);
    } catch (e: any) {
      setError(e.message || "Error loading data");
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Only use true statuses found in DB (stage names)
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!jobs.length || !stages.length) return counts;

    stages.forEach((stage: any) => {
      counts[stage.name] = 0;
    });

    jobs.forEach(job => {
      const status = job.status;
      if (status && counts[status] !== undefined) {
        counts[status]++;
      }
    });

    return counts;
  }, [jobs, stages]);

  const total = jobs.length;
  const completed = jobs.filter(job => job.status === "Completed").length;
  const inProgress = jobs.filter(job => job.status && job.status !== "Completed").length;

  return {
    jobs,
    total,
    inProgress,
    completed,
    statusCounts,
    stages,
    isLoading,
    error,
    refresh: fetchStats,
  };
}
