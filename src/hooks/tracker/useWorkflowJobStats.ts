
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Stage = { id, name, color }
export interface WorkflowStage {
  id: string;
  name: string;
  color: string;
}
export interface WorkflowJob {
  id: string;
  user_id: string;
  status: string;
  category?: string | null;
  customer?: string | null;
  reference?: string | null;
  due_date?: string | null;
  updated_at?: string;
  category_name?: string | null;
}

export interface JobStageInstance {
  id: string;
  job_id: string;
  job_table_name: string;
  production_stage_id: string;
  status: string;
  part_name?: string | null;
  stage_order: number;
}

export interface WorkflowJobStats {
  total: number;
  statusCounts: Record<string, number>;
  inProgress: number;
  completed: number;
  prePress: number;
  stages: WorkflowStage[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useWorkflowJobStats(): WorkflowJobStats {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<WorkflowJob[]>([]);
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [instances, setInstances] = useState<JobStageInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    if (!user?.id) {
      setJobs([]);
      setStages([]);
      setInstances([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // 1. Get jobs for this user
      const { data: jobsRaw, error: jobsErr } = await supabase
        .from("production_jobs")
        .select("id, user_id, status, category, customer, reference, due_date, updated_at, categories(name)")
        .eq("user_id", user.id);

      if (jobsErr) throw jobsErr;
      const jobs = (jobsRaw || []).map((job: any) => ({
        ...job,
        category_name: job.categories?.name ?? job.category ?? null,
      }));
      setJobs(jobs);

      // 2. Get active stages
      const { data: stagesRaw, error: stagesErr } = await supabase
        .from("production_stages")
        .select("id, name, color")
        .eq("is_active", true)
        .order("order_index");

      if (stagesErr) throw stagesErr;
      setStages(stagesRaw || []);

      // 3. Get each job's current active/pending stage instance, only for this user's jobs
      const jobIds = jobs.map(j => j.id);
      const { data: instancesRaw, error: instErr } = await supabase
        .from("job_stage_instances")
        .select("id, job_id, job_table_name, production_stage_id, status, part_name, stage_order")
        .in("job_id", jobIds);

      if (instErr) throw instErr;
      setInstances(instancesRaw || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
      toast.error("Failed to load dashboard workflow data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line
  }, [user?.id]);

  // Compute workflow job stats
  const stats = useMemo(() => {
    if (!jobs.length || !stages.length) {
      return {
        total: 0,
        statusCounts: {},
        inProgress: 0,
        completed: 0,
        prePress: 0,
        stages,
        isLoading,
        error,
        refresh: fetchAll,
      };
    }
    // Map job_id => current workflow stage name
    const jobCurrentStage: Record<
      string,
      { name: string; color: string; status: string }
    > = {};

    // Find the latest (lowest order) ACTIVE or PENDING instance for each job
    jobs.forEach((job) => {
      const thisJobStages = instances.filter(
        (i) =>
          i.job_id === job.id &&
          ["active", "pending"].includes(i.status)
      );
      if (thisJobStages.length) {
        // Pick the lowest stage_order (first uncompleted in workflow)
        const first = [...thisJobStages].sort((a, b) => a.stage_order - b.stage_order)[0];
        const stage = stages.find((s) => s.id === first.production_stage_id);
        if (stage) {
          jobCurrentStage[job.id] = {
            name: stage.name,
            color: stage.color,
            status: first.status,
          };
        }
      }
    });

    // For cards: count how many jobs are currently "in" each stage
    const statusCounts: Record<string, number> = {};
    stages.forEach((s) => {
      statusCounts[s.name] = 0;
    });
    Object.values(jobCurrentStage).forEach(({ name }) => {
      if (name in statusCounts) {
        statusCounts[name] += 1;
      } else {
        statusCounts[name] = 1; // fallback for unmatched names
      }
    });

    // Pre-Press count is jobs with no stage instances at all, or with status "Pre-Press"
    let prePress = 0;
    jobs.forEach((job) => {
      const jobHasStage = instances.some((i) => i.job_id === job.id);
      if (!jobHasStage || (job.status && job.status === "Pre-Press")) {
        prePress += 1;
      }
    });

    // Completed jobs: workflow complete (all stages completed)
    let completed = 0;
    jobs.forEach((job) => {
      const jobInst = instances.filter((i) => i.job_id === job.id);
      // If all stage instances completed, it's completed
      if (
        jobInst.length &&
        jobInst.every((i) => i.status === "completed")
      ) {
        completed += 1;
      }
    });

    // In Progress = jobs in any active or pending workflow stage (not completed, not pre-press)
    let inProgress = Object.keys(jobCurrentStage).length;

    // Total = total jobs count
    const total = jobs.length;

    // Add Pre-Press and Completed to statusCounts for dashboard
    statusCounts["Pre-Press"] = prePress;
    statusCounts["Completed"] = completed;

    return {
      total,
      statusCounts,
      inProgress,
      completed,
      prePress,
      stages,
      isLoading,
      error,
      refresh: fetchAll,
    };
  }, [jobs, stages, instances, isLoading, error]);

  // `stats` matches the expected shape for dashboard components
  return stats;
}
