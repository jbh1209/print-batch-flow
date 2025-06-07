
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

      console.log("🔍 Fetching jobs with corrected database query...");

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

      // Step 3: Get job stage instances for these stages
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
        .eq('job_table_name', 'production_jobs'); // Focus on production_jobs only for now

      if (instancesError) {
        throw new Error(`Failed to get job instances: ${instancesError.message}`);
      }

      console.log("📋 Job stage instances:", jobStageInstances?.length || 0);

      if (!jobStageInstances || jobStageInstances.length === 0) {
        setJobs([]);
        return;
      }

      // Step 4: Get the actual job details
      const jobIds = jobStageInstances.map(jsi => jsi.job_id);
      const { data: productionJobs, error: jobsError } = await supabase
        .from('production_jobs')
        .select('id, wo_no, customer, status, due_date')
        .in('id', jobIds);

      if (jobsError) {
        throw new Error(`Failed to get production jobs: ${jobsError.message}`);
      }

      console.log("🏭 Production jobs:", productionJobs?.length || 0);

      // Step 5: Combine the data
      const accessibleJobs = (jobStageInstances || []).map(instance => {
        const job = productionJobs?.find(pj => pj.id === instance.job_id);
        if (!job) return null;

        return {
          id: job.id,
          wo_no: job.wo_no,
          customer: job.customer || 'Unknown',
          status: job.status || 'Unknown',
          due_date: job.due_date || '',
          current_stage_name: instance.production_stages.name,
          current_stage_id: instance.production_stage_id,
          stage_status: instance.status as 'active' | 'pending',
          can_work: true
        };
      }).filter(Boolean) as SimpleJob[];

      // Remove duplicates by job ID (in case job has multiple accessible stages)
      const uniqueJobs = accessibleJobs.reduce((acc, job) => {
        const existing = acc.find(j => j.id === job.id);
        if (!existing) {
          acc.push(job);
        } else if (job.stage_status === 'active' && existing.stage_status === 'pending') {
          // Prioritize active stages over pending ones
          Object.assign(existing, job);
        }
        return acc;
      }, [] as SimpleJob[]);

      console.log("✅ Final accessible jobs:", uniqueJobs.length);
      setJobs(uniqueJobs);
      
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
      
      const { error } = await supabase.rpc('advance_job_stage', {
        p_job_id: jobId,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: stageId
      });

      if (error) throw error;

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
