
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface AccessibleJob {
  job_id: string;
  wo_no: string;
  customer: string;
  status: string;
  due_date: string;
  reference: string | null;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  current_stage_id: string | null;
  current_stage_name: string | null;
  current_stage_color: string | null;
  current_stage_status: string;
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
  const { user, isLoading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<AccessibleJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    permissionType = 'work',
    statusFilter = null,
    stageFilter = null
  } = options;

  const fetchJobs = useCallback(async () => {
    if (!user?.id) {
      console.log("❌ No user ID available, skipping fetch");
      setJobs([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log("🔍 Fetching accessible jobs with params:", {
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
        console.error("❌ Database function error:", fetchError);
        throw new Error(`Failed to fetch jobs: ${fetchError.message}`);
      }

      console.log("✅ Database function success:", {
        count: data?.length || 0
      });

      if (data && Array.isArray(data)) {
        const normalizedJobs = data.map((job, index) => ({
          job_id: String(job.job_id || ''),
          wo_no: String(job.wo_no || ''),
          customer: String(job.customer || 'Unknown'),
          status: String(job.status || 'Unknown'),
          due_date: String(job.due_date || ''),
          reference: job.reference ? String(job.reference) : null,
          category_id: job.category_id ? String(job.category_id) : null,
          category_name: job.category_name ? String(job.category_name) : null,
          category_color: job.category_color ? String(job.category_color) : null,
          current_stage_id: job.current_stage_id ? String(job.current_stage_id) : null,
          current_stage_name: job.current_stage_name ? String(job.current_stage_name) : null,
          current_stage_color: job.current_stage_color ? String(job.current_stage_color) : null,
          current_stage_status: String(job.current_stage_status || 'pending'),
          user_can_view: Boolean(job.user_can_view),
          user_can_edit: Boolean(job.user_can_edit),
          user_can_work: Boolean(job.user_can_work),
          user_can_manage: Boolean(job.user_can_manage),
          workflow_progress: Number(job.workflow_progress) || 0,
          total_stages: Number(job.total_stages) || 0,
          completed_stages: Number(job.completed_stages) || 0
        }));

        console.log("✅ Normalized jobs:", normalizedJobs.length);
        setJobs(normalizedJobs);
      } else {
        console.log("⚠️ No valid data returned from database function");
        setJobs([]);
      }
      
    } catch (err) {
      console.error('❌ Error in fetchJobs:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load accessible jobs";
      setError(errorMessage);
      setJobs([]);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, permissionType, statusFilter, stageFilter]);

  const startJob = useCallback(async (jobId: string, stageId: string) => {
    if (!user?.id) {
      toast.error("User not authenticated");
      return false;
    }

    try {
      console.log('🚀 Starting job stage:', { jobId, stageId, userId: user.id });
      
      const { data: firstPendingStage, error: findError } = await supabase
        .from('job_stage_instances')
        .select('id, production_stage_id, stage_order')
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .eq('status', 'pending')
        .order('stage_order', { ascending: true })
        .limit(1)
        .single();

      if (findError || !firstPendingStage) {
        console.error("❌ No pending stage found:", findError);
        toast.error("No pending stage found to start");
        return false;
      }

      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', firstPendingStage.id);

      if (error) {
        console.error("❌ Error starting job stage:", error);
        throw error;
      }

      console.log("✅ Job stage started successfully");
      toast.success("Job started successfully");
      await fetchJobs();
      return true;
    } catch (err) {
      console.error('❌ Error starting job:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to start job";
      toast.error(errorMessage);
      return false;
    }
  }, [user?.id, fetchJobs]);

  const completeJob = useCallback(async (jobId: string, stageId: string) => {
    if (!user?.id) {
      toast.error("User not authenticated");
      return false;
    }

    try {
      console.log('✅ Completing job stage:', { jobId, stageId, userId: user.id });
      
      const { data: activeStage, error: findError } = await supabase
        .from('job_stage_instances')
        .select('id, production_stage_id, stage_order')
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .eq('status', 'active')
        .single();

      if (findError || !activeStage) {
        console.error("❌ No active stage found:", findError);
        toast.error("No active stage found to complete");
        return false;
      }

      const { error: completeError } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', activeStage.id);

      if (completeError) {
        console.error("❌ Error completing stage:", completeError);
        throw completeError;
      }

      const { data: nextStage, error: nextError } = await supabase
        .from('job_stage_instances')
        .select('id')
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .eq('status', 'pending')
        .gt('stage_order', activeStage.stage_order)
        .order('stage_order', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextError) {
        console.error("❌ Error finding next stage:", nextError);
      } else if (nextStage) {
        const { error: activateError } = await supabase
          .from('job_stage_instances')
          .update({ 
            status: 'active',
            started_at: new Date().toISOString(),
            started_by: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', nextStage.id);

        if (activateError) {
          console.error("❌ Error activating next stage:", activateError);
        }
      }

      console.log("✅ Job stage completed successfully");
      toast.success("Job stage completed successfully");
      await fetchJobs();
      return true;
    } catch (err) {
      console.error('❌ Error completing job:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to complete job";
      toast.error(errorMessage);
      return false;
    }
  }, [user?.id, fetchJobs]);

  useEffect(() => {
    console.log("🔄 useAccessibleJobs effect triggered", {
      authLoading,
      userId: user?.id
    });
    
    if (!authLoading) {
      if (user?.id) {
        fetchJobs().catch(error => {
          console.error("Failed to fetch jobs in effect:", error);
          setError("Failed to load jobs on initial load");
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
        setJobs([]);
        setError(null);
      }
    }
  }, [authLoading, user?.id, fetchJobs]);

  return {
    jobs,
    isLoading: isLoading || authLoading,
    error,
    startJob,
    completeJob,
    refreshJobs: fetchJobs
  };
};
