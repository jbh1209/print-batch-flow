
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

  // FIXED: Use job_id instead of id to match useAccessibleJobs data structure
  const jobIds = jobs.map((job) => job.job_id || job.id);
  
  console.log('🔍 fetchJobStagesFromSupabase: Processing jobs', {
    totalJobs: jobs.length,
    jobIds: jobIds.slice(0, 3), // Log first 3 for debugging
    firstJobStructure: jobs[0] ? Object.keys(jobs[0]) : 'no jobs'
  });

  if (jobIds.length === 0) {
    console.warn('⚠️ No valid job IDs found in jobs array');
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
      console.error('❌ Error fetching job stages:', error);
      throw error;
    }

    console.log('✅ fetchJobStagesFromSupabase: Fetched stages', {
      stagesCount: data?.length || 0,
      uniqueJobIds: new Set(data?.map(s => s.job_id) || []).size
    });

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
          console.warn('⚠️ Job not found for stage:', stage.job_id);
          return null;
        }
        
        // Defensive null-safe
        let dueDate: string | undefined =
          job?.due_date ||
          computeDueDate(job);

        return {
          ...stage,
          status: stage.status as "pending" | "active" | "completed" | "skipped",
          production_stage: stage.production_stage,
          production_job: {
            id: job.job_id || job.id, // Use job_id as primary, fallback to id
            wo_no: job.wo_no,
            customer: job.customer ?? null,
            category: job.category ?? null,
            due_date: dueDate ?? null,
            created_at: job.created_at ?? null,
            category_name: job.category_name ?? null,
            categories: job.categories ?? null,
            sla_target_days: getJobSlaDays(job)
          },
        };
      })
      .filter((stage: JobStageWithDetails | null): stage is JobStageWithDetails => 
        stage !== null && stage.production_job !== undefined
      );
  } catch (err) {
    console.error('❌ fetchJobStagesFromSupabase error:', err);
    throw err;
  }
}
