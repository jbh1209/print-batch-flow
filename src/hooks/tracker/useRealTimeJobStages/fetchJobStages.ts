
import { supabase } from "@/integrations/supabase/client";
import { JobStageWithDetails } from "./types";

/**
 * Fetch job stages for the active jobs provided.
 * Returns an enriched array of JobStageWithDetails.
 */
export async function fetchJobStagesFromSupabase(jobs: any[]): Promise<JobStageWithDetails[]> {
  if (!jobs || jobs.length === 0) return [];
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
  return (data || [])
    .map((stage: any) => {
      const job = jobs.find(j => j.id === stage.job_id);
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
              due_date: job.due_date,
            }
          : undefined,
      };
    })
    .filter((stage: JobStageWithDetails) => stage.production_job);
}
