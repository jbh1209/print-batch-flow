
import { supabase } from "@/integrations/supabase/client";
import { JobStageWithDetails } from "./types";

/**
 * Fetch job stages for the active jobs provided.
 * Returns an enriched array of JobStageWithDetails.
 */
export async function fetchJobStagesFromSupabase(
  jobs: Array<any>
): Promise<JobStageWithDetails[]> {
  if (!jobs || jobs.length === 0) return [];

  // Helper: lookup SLA target days for a job
  const getJobSlaDays = (job: any) =>
    job.manual_sla_days ??
    job.categories?.sla_target_days ??
    (typeof job.sla_target_days === "number" ? job.sla_target_days : 3);

  // Helper: compute due date if missing
  const computeDueDate = (job: any): string | undefined => {
    // For custom workflows, prefer manual_due_date
    if (job.has_custom_workflow && job.manual_due_date) {
      return job.manual_due_date;
    }
    
    if (job.due_date) return job.due_date;
    
    const sla = getJobSlaDays(job);
    if (job.created_at) {
      const createdAt = new Date(job.created_at);
      createdAt.setDate(createdAt.getDate() + sla);
      return createdAt.toISOString().split("T")[0];
    }
    return undefined;
  };

  const jobIds = jobs.map((job) => job.job_id || job.id);
  
  if (jobIds.length === 0) {
    return [];
  }

  try {
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

    if (error) {
      throw error;
    }

    // Create lookup by both job_id and id for compatibility
    const jobsById: Record<string, any> = {};
    jobs.forEach((job) => {
      const jobId = job.job_id || job.id;
      if (jobId) {
        jobsById[jobId] = job;
      }
    });

    return (data || [])
      .map((stage: any) => {
        const job = jobsById[stage.job_id];
        if (!job) {
          return null;
        }
        
        const dueDate: string | undefined = computeDueDate(job);

        return {
          ...stage,
          status: stage.status as "pending" | "active" | "completed" | "skipped",
          production_stage: stage.production_stage,
          production_job: {
            id: job.job_id || job.id,
            wo_no: job.wo_no,
            customer: job.customer ?? null,
            category: job.category ?? null,
            due_date: dueDate ?? null,
            created_at: job.created_at ?? null,
            category_name: job.category_name ?? null,
            categories: job.categories ?? null,
            sla_target_days: getJobSlaDays(job),
            has_custom_workflow: job.has_custom_workflow ?? false,
            manual_due_date: job.manual_due_date ?? null,
            manual_sla_days: job.manual_sla_days ?? null
          },
        };
      })
      .filter((stage: JobStageWithDetails | null): stage is JobStageWithDetails => 
        stage !== null && stage.production_job !== undefined
      );
  } catch (err) {
    console.error('Error fetching job stages:', err);
    throw err;
  }
}
