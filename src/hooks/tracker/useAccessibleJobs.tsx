
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatWONumber } from "@/utils/woNumberFormatter";

export interface AccessibleJob {
  job_id: string;
  wo_no: string;
  customer: string;
  status: string;
  due_date: string;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  current_stage_id: string | null;
  current_stage_name: string | null;
  current_stage_color: string | null;
  current_stage_status: string | null;
  user_can_view: boolean;
  user_can_edit: boolean;
  user_can_work: boolean;
  user_can_manage: boolean;
  workflow_progress: number;
  total_stages: number;
  completed_stages: number;
}

export interface UseAccessibleJobsOptions {
  permissionType?: 'view' | 'edit' | 'work' | 'manage';
  statusFilter?: string | null;
  stageFilter?: string | null;
}

export const useAccessibleJobs = (options: UseAccessibleJobsOptions = {}) => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<AccessibleJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    permissionType = 'view',
    statusFilter = null,
    stageFilter = null
  } = options;

  const fetchJobs = useCallback(async () => {
    if (!user?.id) {
      setJobs([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log("🔍 Fetching accessible jobs via database function...", {
        userId: user.id,
        permissionType,
        statusFilter,
        stageFilter
      });

      const { data, error: fetchError } = await supabase.rpc('get_user_accessible_jobs', {
        p_user_id: user.id,
        p_permission_type: permissionType,
        p_status_filter: statusFilter,
        p_stage_filter: stageFilter
      });

      if (fetchError) {
        console.error("Database function error:", fetchError);
        throw new Error(`Failed to fetch accessible jobs: ${fetchError.message}`);
      }

      console.log("✅ Raw database response:", data);

      // Transform and normalize the data to match our interface
      const normalizedJobs = (data || []).map((job: any) => ({
        job_id: job.job_id,
        wo_no: formatWONumber(job.wo_no),
        customer: job.customer || 'Unknown',
        status: job.status || 'Unknown',
        due_date: job.due_date || '',
        category_id: job.category_id || null,
        category_name: job.category_name || null,
        category_color: job.category_color || null,
        current_stage_id: job.current_stage_id || null,
        current_stage_name: job.current_stage_name || null,
        current_stage_color: job.current_stage_color || null,
        current_stage_status: job.current_stage_status || null,
        user_can_view: Boolean(job.user_can_view),
        user_can_edit: Boolean(job.user_can_edit),
        user_can_work: Boolean(job.user_can_work),
        user_can_manage: Boolean(job.user_can_manage),
        workflow_progress: Number(job.workflow_progress) || 0,
        total_stages: Number(job.total_stages) || 0,
        completed_stages: Number(job.completed_stages) || 0
      }));

      console.log("✅ Normalized accessible jobs:", normalizedJobs.length);
      setJobs(normalizedJobs);
      
    } catch (err) {
      console.error('❌ Error fetching accessible jobs:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load accessible jobs";
      setError(errorMessage);
      toast.error("Failed to load accessible jobs");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, permissionType, statusFilter, stageFilter]);

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
      await fetchJobs();
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
      await fetchJobs();
      return true;
    } catch (err) {
      console.error('Error completing job:', err);
      toast.error("Failed to complete job");
      return false;
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    console.log("Setting up real-time subscription for accessible jobs");

    const channel = supabase
      .channel(`accessible_jobs_${user?.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_jobs',
        },
        () => {
          console.log('Production jobs changed - refetching');
          fetchJobs();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_stage_instances',
        },
        () => {
          console.log('Job stage instances changed - refetching');
          fetchJobs();
        }
      )
      .subscribe();

    return () => {
      console.log("Cleaning up accessible jobs real-time subscription");
      supabase.removeChannel(channel);
    };
  }, [fetchJobs, user?.id]);

  return {
    jobs,
    isLoading,
    error,
    startJob,
    completeJob,
    refreshJobs: fetchJobs
  };
};
