import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EligibleJob {
  id: string;
  wo_no: string;
  proof_approved_at: string;
}

export interface ScheduledJob {
  id: string;
  wo_no: string;
}

export interface ScheduleDiagnostics {
  eligible: EligibleJob[];
  scheduled: ScheduledJob[];
  missing: EligibleJob[];
  extra: ScheduledJob[];
}

export function useScheduleDiagnostics() {
  const [isLoading, setIsLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ScheduleDiagnostics>({
    eligible: [],
    scheduled: [],
    missing: [],
    extra: []
  });

  const fetchDiagnostics = async () => {
    setIsLoading(true);
    try {
      // Query A: Approved, incomplete jobs (eligible to be scheduled)
      const { data: eligibleData, error: eligibleError } = await supabase
        .from("production_jobs")
        .select(`
          id,
          wo_no,
          proof_approved_at,
          job_stage_instances!job_stage_instances_job_id_fkey(
            id,
            completed_at
          )
        `)
        .not("proof_approved_at", "is", null)
        .order("proof_approved_at", { ascending: true });

      if (eligibleError) throw eligibleError;

      // Filter to jobs with at least one incomplete stage
      const eligible: EligibleJob[] = (eligibleData || [])
        .filter(job => 
          job.job_stage_instances.some((stage: any) => !stage.completed_at)
        )
        .map(job => ({
          id: job.id,
          wo_no: job.wo_no,
          proof_approved_at: job.proof_approved_at!
        }));

      // Query B: Jobs currently scheduled on the board
      const { data: scheduledData, error: scheduledError } = await supabase
        .from("job_stage_instances")
        .select(`
          job_id,
          production_job:production_jobs!job_stage_instances_job_id_fkey(id, wo_no)
        `)
        .not("scheduled_start_at", "is", null)
        .not("scheduled_end_at", "is", null)
        .eq("schedule_status", "scheduled");

      if (scheduledError) throw scheduledError;

      // Get unique scheduled jobs
      const scheduledJobsMap = new Map<string, ScheduledJob>();
      (scheduledData || []).forEach((item: any) => {
        if (item.production_job) {
          scheduledJobsMap.set(item.production_job.id, {
            id: item.production_job.id,
            wo_no: item.production_job.wo_no
          });
        }
      });
      const scheduled = Array.from(scheduledJobsMap.values());

      // Calculate diffs
      const eligibleIds = new Set(eligible.map(j => j.id));
      const scheduledIds = new Set(scheduled.map(j => j.id));

      const missing = eligible.filter(j => !scheduledIds.has(j.id));
      const extra = scheduled.filter(j => !eligibleIds.has(j.id));

      setDiagnostics({
        eligible,
        scheduled,
        missing,
        extra
      });
    } catch (error) {
      console.error("Failed to fetch schedule diagnostics:", error);
      setDiagnostics({
        eligible: [],
        scheduled: [],
        missing: [],
        extra: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    diagnostics,
    fetchDiagnostics
  };
}
