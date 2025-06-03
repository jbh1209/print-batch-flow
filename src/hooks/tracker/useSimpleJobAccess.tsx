
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

      console.log("🔍 Fetching jobs with direct database query...");

      // Direct query: Get all jobs where user has 'can_work' permission on current stage
      const { data, error: queryError } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          job_id,
          production_stage_id,
          status,
          production_stages!inner (
            id,
            name,
            color
          ),
          production_jobs!inner (
            id,
            wo_no,
            customer,
            status,
            due_date
          ),
          user_group_stage_permissions!inner (
            can_work,
            user_group_id,
            user_group_memberships!inner (
              user_id
            )
          )
        `)
        .eq('user_group_stage_permissions.user_group_memberships.user_id', user.id)
        .eq('user_group_stage_permissions.can_work', true)
        .in('status', ['active', 'pending']);

      if (queryError) {
        throw new Error(`Database query failed: ${queryError.message}`);
      }

      console.log("📊 Raw accessible jobs data:", data?.length || 0);

      // Transform the data into simple job objects
      const accessibleJobs = (data || []).map(item => ({
        id: item.production_jobs.id,
        wo_no: item.production_jobs.wo_no,
        customer: item.production_jobs.customer || 'Unknown',
        status: item.production_jobs.status || 'Unknown',
        due_date: item.production_jobs.due_date || '',
        current_stage_name: item.production_stages.name,
        current_stage_id: item.production_stage_id,
        stage_status: item.status as 'active' | 'pending',
        can_work: true // This is guaranteed true from our query
      }));

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

      console.log("✅ Processed accessible jobs:", uniqueJobs.length);
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
