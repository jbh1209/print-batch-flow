
import { supabase } from "@/integrations/supabase/client";
import { JobStageWithDetails } from "./types";

/**
 * Fetch job stages for the active jobs provided.
 * Returns an enriched array of JobStageWithDetails.
 */
export async function fetchJobStagesFromSupabase(
  jobs: Array<any> // Expects jobs with enriched `categories` info
): Promise<JobStageWithDetails[]> {
  if (!jobs || jobs.length === 0) return [];

  // Helper: lookup SLA target days for a job (prefer join, fallback to 3)
  const getJobSlaDays = (job: any) =>
    job.categories?.sla_target_days ??
    (typeof job.sla_target_days === "number" ? job.sla_target_days : 3);

  // Helper: compute due date if missing (created_at + SLA)
  const computeDueDate = (job: any): string | undefined => {
    if (job.due_date) return job.due_date;
    const sla = getJobSlaDays(job);
    if (job.created_at) {
      const createdAt = new Date(job.created_at);
      createdAt.setDate(createdAt.getDate() + sla);
      return createdAt.toISOString().split("T")[0];
    }
    return undefined;
  };

  // Get all job stage instances for these jobs
  const jobIds = jobs.map((job) => job.id);
  const { data, error } = await supabase
    .from("job_stage_instances")
    .select(
      `
      *,
      production_stage:production_stages(
        id, name, color, description
      )
    `
    )
    .in("job_id", jobIds)
    .eq("job_table_name", "production_jobs")
    .order("stage_order", { ascending: true });

  if (error) throw error;

  // Lookup by id for easy mapping
  const jobsById: Record<string, any> = {};
  jobs.forEach((job) => {
    jobsById[job.id] = job;
  });

  return (data || [])
    .map((stage: any) => {
      const job = jobsById[stage.job_id];
      // Defensive null-safe
      let dueDate: string | undefined =
        job?.due_date ||
        computeDueDate(job);

      return {
        ...stage,
        status: stage.status as "pending" | "active" | "completed" | "skipped",
        production_stage: stage.production_stage,
        production_job: job
          ? {
              id: job.id,
              wo_no: job.wo_no,
              customer: job.customer ?? null,
              category: job.category ?? null,
              due_date: dueDate ?? null,
              created_at: job.created_at ?? null,
              category_name: job.category_name ?? null,
              categories: job.categories ?? null,
              sla_target_days: getJobSlaDays(job)
            }
          : undefined,
      };
    })
    .filter((stage: JobStageWithDetails) => stage.production_job);
}
