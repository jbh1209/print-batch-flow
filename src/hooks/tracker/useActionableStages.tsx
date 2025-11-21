import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AccessibleJob } from "./useAccessibleJobs";

interface ActionableStage {
  job_id: string;
  production_stage_id: string;
  status: string;
  stage_order: number;
}

/**
 * Fetches only actionable stages for given jobs
 * - Active stages are always actionable
 * - Pending stages within 50 orders of earliest pending/active stage
 * This prevents jobs from appearing in all future stages
 */
export const useActionableStages = (jobs: AccessibleJob[]) => {
  return useQuery({
    queryKey: ['actionable-stages', jobs.map(j => j.id).sort().join(',')],
    queryFn: async () => {
      if (!jobs.length) return new Map<string, string[]>();
      
      const jobIds = jobs.map(j => j.id);
      
      // Query all pending/active stages for these jobs
      const { data, error } = await supabase
        .from('job_stage_instances')
        .select('job_id, production_stage_id, status, stage_order')
        .in('job_id', jobIds)
        .in('status', ['pending', 'active']);
      
      if (error) throw error;
      
      // Group stages by job_id
      const stagesByJob = new Map<string, ActionableStage[]>();
      data?.forEach(stage => {
        if (!stagesByJob.has(stage.job_id)) {
          stagesByJob.set(stage.job_id, []);
        }
        stagesByJob.get(stage.job_id)!.push(stage);
      });
      
      // Filter to actionable stages for each job
      const actionableMap = new Map<string, string[]>();
      
      stagesByJob.forEach((stages, jobId) => {
        if (stages.length === 0) return;
        
        // Find minimum stage order
        const minOrder = Math.min(...stages.map(s => s.stage_order || 0));
        
        // Keep only actionable stages (active OR pending within range)
        const actionable = stages.filter(stage => 
          stage.status === 'active' || 
          (stage.status === 'pending' && (stage.stage_order || 0) <= minOrder + 50)
        );
        
        // Map to stage IDs
        actionableMap.set(
          jobId, 
          actionable.map(s => s.production_stage_id)
        );
      });
      
      return actionableMap;
    },
    enabled: jobs.length > 0,
    staleTime: 10000, // 10 seconds
    refetchOnWindowFocus: true
  });
};
