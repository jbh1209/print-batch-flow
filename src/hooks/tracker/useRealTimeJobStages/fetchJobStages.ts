
import { supabase } from "@/integrations/supabase/client";
import { JobStageWithDetails } from "./types";

/**
 * Fetch job stages for the active jobs provided.
 * Returns an enriched array of JobStageWithDetails.
 */
export async function fetchJobStagesFromSupabase(jobs: any[]): Promise<JobStageWithDetails[]> {
  if (!jobs || jobs.length === 0) return [];

  // Helper: lookup SLA target days for a job (fallback to 3 days)
  const getJobSlaDays = (job: any) =>
    (job.categories && typeof job.categories.sla_target_days === "number" ? job.categories.sla_target_days : 3);

  // Helper: compute due date if missing
  const computeDueDate = (job: any): string | undefined => {
    if (job.due_date) return job.due_date;
    const sla = getJobSlaDays(job);
    // fallback: created_at + sla days (if created_at is present)
    if (job.created_at) {
      const createdAt = new Date(job.created_at);
      createdAt.setDate(createdAt.getDate() + sla);
      return createdAt.toISOString().split('T')[0];
    }
    return undefined;
  };

  const { data, error } = await supabase
    .from('job_stage_instances')
    .select(`
      *,
      production_stage:production_stages(
        id,
        name,
        color,
        description
      )
    `)
    .eq('job_table_name', 'production_jobs')
    .order('stage_order');
  if (error) throw error;
  // Create a lookup of jobs by id for quick access
  const jobsById = Object.fromEntries(jobs.map((job) => [job.id, job]));
  return (data || [])
    .map((stage: any) => {
      const job = jobsById[stage.job_id];
      // If the DB doesn't join job info, inject due_date from job or compute if missing
      let dueDate = job?.due_date || computeDueDate(job);
      if (!dueDate && job) {
        console.warn(
          "⚠️ Job",
          job.wo_no,
          "is missing due date; category:",
          job.category_name,
          "created:",
          job.created_at
        );
      }
      return {
        ...stage,
        status: stage.status as 'pending' | 'active' | 'completed' | 'skipped',
        production_stage: stage.production_stage,
        production_job: job
          ? {
              id: job.id,
              wo_no: job.wo_no,
              customer: job.customer,
              category: job.category,
              due_date: dueDate,
              category_name: job.category_name,
              sla_target_days: getJobSlaDays(job)
            }
          : undefined,
      };
    })
    .filter((stage: JobStageWithDetails) => stage.production_job);
}
