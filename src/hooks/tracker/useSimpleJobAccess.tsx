
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface SimpleJob {
  id: string;
  wo_no: string;
  customer: string;
  status: string;
  due_date: string;
  current_stage_name: string;
  current_stage_id: string;
  stage_status: 'active' | 'pending';
  can_work: boolean;
  has_workflow: boolean; // Track if job uses new workflow system
}

export const useSimpleJobAccess = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<SimpleJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccessibleJobs = useCallback(async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      setError(null);

      console.log("🔍 Fetching jobs with hybrid approach...");

      // Step 1: Get user's groups
      const { data: userGroups, error: groupsError } = await supabase
        .from('user_group_memberships')
        .select('group_id')
        .eq('user_id', user.id);

      if (groupsError) {
        throw new Error(`Failed to get user groups: ${groupsError.message}`);
      }

      if (!userGroups || userGroups.length === 0) {
        console.log("❌ User has no group memberships");
        setJobs([]);
        return;
      }

      const groupIds = userGroups.map(ug => ug.group_id);
      console.log("👥 User groups:", groupIds);

      // Step 2: Get stages user can work on
      const { data: workableStages, error: stagesError } = await supabase
        .from('user_group_stage_permissions')
        .select('production_stage_id')
        .in('user_group_id', groupIds)
        .eq('can_work', true);

      if (stagesError) {
        throw new Error(`Failed to get workable stages: ${stagesError.message}`);
      }

      if (!workableStages || workableStages.length === 0) {
        console.log("❌ User has no workable stage permissions");
        setJobs([]);
        return;
      }

      const stageIds = workableStages.map(ws => ws.production_stage_id);
      console.log("🎯 Workable stages:", stageIds);

      // Step 3: Get all production jobs first
      const { data: productionJobs, error: jobsError } = await supabase
        .from('production_jobs')
        .select('id, wo_no, customer, status, due_date');

      if (jobsError) {
        throw new Error(`Failed to get production jobs: ${jobsError.message}`);
      }

      console.log("🏭 Total production jobs:", productionJobs?.length || 0);

      // Step 4: Get job stage instances for jobs that have them
      const { data: jobStageInstances, error: instancesError } = await supabase
        .from('job_stage_instances')
        .select(`
          job_id,
          job_table_name,
          production_stage_id,
          status,
          production_stages!inner (
            id,
            name
          )
        `)
        .in('production_stage_id', stageIds)
        .in('status', ['active', 'pending'])
        .eq('job_table_name', 'production_jobs');

      if (instancesError) {
        console.log("⚠️ Error getting job instances (non-fatal):", instancesError);
      }

      console.log("📋 Job stage instances:", jobStageInstances?.length || 0);

      // Step 5: Create hybrid job list
      const accessibleJobs: SimpleJob[] = [];

      if (productionJobs) {
        for (const job of productionJobs) {
          // Check if this job has stage instances
          const jobInstance = jobStageInstances?.find(jsi => jsi.job_id === job.id);
          
          if (jobInstance) {
            // Job uses new workflow system
            accessibleJobs.push({
              id: job.id,
              wo_no: job.wo_no,
              customer: job.customer || 'Unknown',
              status: job.status || 'Unknown',
              due_date: job.due_date || '',
              current_stage_name: jobInstance.production_stages.name,
              current_stage_id: jobInstance.production_stage_id,
              stage_status: jobInstance.status as 'active' | 'pending',
              can_work: true,
              has_workflow: true
            });
          } else {
            // Job uses old status-based system - make accessible for DTP stages
            const isDtpJob = ['Pre-Press', 'DTP', 'Design', 'Artwork'].includes(job.status || '');
            const isProofJob = ['Proof', 'Proofing', 'Review'].includes(job.status || '');
            
            if (isDtpJob || isProofJob) {
              // Create a virtual stage for this job based on status
              const virtualStageId = stageIds.find(stageId => {
                // This would need stage name mapping, for now use first available stage
                return true;
              }) || stageIds[0];

              if (virtualStageId) {
                accessibleJobs.push({
                  id: job.id,
                  wo_no: job.wo_no,
                  customer: job.customer || 'Unknown',
                  status: job.status || 'Unknown',
                  due_date: job.due_date || '',
                  current_stage_name: job.status || 'Ready',
                  current_stage_id: virtualStageId,
                  stage_status: 'pending',
                  can_work: true,
                  has_workflow: false
                });
              }
            }
          }
        }
      }

      console.log("✅ Final accessible jobs (hybrid):", accessibleJobs.length);
      setJobs(accessibleJobs);
      
    } catch (err) {
      console.error('❌ Error fetching accessible jobs:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load accessible jobs";
      setError(errorMessage);
      toast.error("Failed to load accessible jobs");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const startJob = async (jobId: string, stageId: string) => {
    try {
      console.log('Starting job:', { jobId, stageId });
      
      const job = jobs.find(j => j.id === jobId);
      
      if (job?.has_workflow) {
        // Use new workflow system
        const { error } = await supabase
          .from('job_stage_instances')
          .update({ 
            status: 'active',
            started_at: new Date().toISOString(),
            started_by: user?.id
          })
          .eq('job_id', jobId)
          .eq('production_stage_id', stageId)
          .eq('status', 'pending');

        if (error) throw error;
      } else {
        // Use old status system - just mark as started
        console.log('Job uses old system, marking as started');
      }

      toast.success("Job started successfully");
      await fetchAccessibleJobs();
      return true;
    } catch (err) {
      console.error('Error starting job:', err);
      toast.error("Failed to start job");
      return false;
    }
  };

  const completeJob = async (jobId: string, stageId: string) => {
    try {
      console.log('Completing job:', { jobId, stageId });
      
      const job = jobs.find(j => j.id === jobId);
      
      if (job?.has_workflow) {
        // Use new workflow system
        const { error } = await supabase.rpc('advance_job_stage', {
          p_job_id: jobId,
          p_job_table_name: 'production_jobs',
          p_current_stage_id: stageId
        });

        if (error) throw error;
      } else {
        // Use old status system - update job status
        const { error } = await supabase
          .from('production_jobs')
          .update({ 
            status: 'Printing', // Move to next logical status
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);

        if (error) throw error;
      }

      toast.success("Job completed successfully");
      await fetchAccessibleJobs();
      return true;
    } catch (err) {
      console.error('Error completing job:', err);
      toast.error("Failed to complete job");
      return false;
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchAccessibleJobs();
    }
  }, [user?.id, fetchAccessibleJobs]);

  return {
    jobs,
    isLoading,
    error,
    startJob,
    completeJob,
    refreshJobs: fetchAccessibleJobs
  };
};
