
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
        console.error("❌ Database function error:", fetchError);
        
        // Handle specific error types
        if (fetchError.message?.includes('structure of query does not match function result type')) {
          throw new Error('Database function signature mismatch. Please contact support.');
        } else if (fetchError.message?.includes('permission denied')) {
          throw new Error('Access denied. Please check your permissions.');
        } else {
          throw new Error(`Failed to fetch accessible jobs: ${fetchError.message}`);
        }
      }

      console.log("✅ Raw database response:", data?.length, "jobs");

      // Validate and normalize the data to match our interface
      if (!Array.isArray(data)) {
        console.warn("⚠️ Database returned non-array data:", data);
        setJobs([]);
        return;
      }

      const normalizedJobs = data.map((job: any, index: number) => {
        try {
          // Ensure all required fields are present and properly typed
          const normalizedJob: AccessibleJob = {
            job_id: String(job.job_id || ''),
            wo_no: formatWONumber(job.wo_no) || '',
            customer: String(job.customer || 'Unknown'),
            status: String(job.status || 'Unknown'),
            due_date: String(job.due_date || ''),
            category_id: job.category_id ? String(job.category_id) : null,
            category_name: job.category_name ? String(job.category_name) : null,
            category_color: job.category_color ? String(job.category_color) : null,
            current_stage_id: job.current_stage_id ? String(job.current_stage_id) : null,
            current_stage_name: job.current_stage_name ? String(job.current_stage_name) : null,
            current_stage_color: job.current_stage_color ? String(job.current_stage_color) : null,
            current_stage_status: job.current_stage_status ? String(job.current_stage_status) : null,
            user_can_view: Boolean(job.user_can_view),
            user_can_edit: Boolean(job.user_can_edit),
            user_can_work: Boolean(job.user_can_work),
            user_can_manage: Boolean(job.user_can_manage),
            workflow_progress: Number(job.workflow_progress) || 0,
            total_stages: Number(job.total_stages) || 0,
            completed_stages: Number(job.completed_stages) || 0
          };

          // Validate numeric fields are within expected ranges
          if (normalizedJob.workflow_progress < 0 || normalizedJob.workflow_progress > 100) {
            console.warn(`⚠️ Invalid workflow_progress for job ${normalizedJob.job_id}:`, normalizedJob.workflow_progress);
            normalizedJob.workflow_progress = 0;
          }

          if (normalizedJob.total_stages < 0) {
            console.warn(`⚠️ Invalid total_stages for job ${normalizedJob.job_id}:`, normalizedJob.total_stages);
            normalizedJob.total_stages = 0;
          }

          if (normalizedJob.completed_stages < 0) {
            console.warn(`⚠️ Invalid completed_stages for job ${normalizedJob.job_id}:`, normalizedJob.completed_stages);
            normalizedJob.completed_stages = 0;
          }

          return normalizedJob;
        } catch (jobError) {
          console.error(`❌ Error normalizing job at index ${index}:`, jobError, job);
          // Return a minimal valid job object to prevent crashes
          return {
            job_id: String(job.job_id || index),
            wo_no: 'ERROR',
            customer: 'Error Loading Job',
            status: 'Unknown',
            due_date: '',
            category_id: null,
            category_name: null,
            category_color: null,
            current_stage_id: null,
            current_stage_name: null,
            current_stage_color: null,
            current_stage_status: null,
            user_can_view: false,
            user_can_edit: false,
            user_can_work: false,
            user_can_manage: false,
            workflow_progress: 0,
            total_stages: 0,
            completed_stages: 0
          } as AccessibleJob;
        }
      });

      console.log("✅ Normalized accessible jobs:", normalizedJobs.length);
      setJobs(normalizedJobs);
      
    } catch (err) {
      console.error('❌ Error fetching accessible jobs:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load accessible jobs";
      setError(errorMessage);
      toast.error(errorMessage);
      setJobs([]); // Set empty array on error to prevent UI crashes
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, permissionType, statusFilter, stageFilter]);

  const startJob = async (jobId: string, stageId: string) => {
    if (!user?.id) {
      toast.error("User not authenticated");
      return false;
    }

    try {
      console.log('🚀 Starting job:', { jobId, stageId, userId: user.id });
      
      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: user.id
        })
        .eq('job_id', jobId)
        .eq('production_stage_id', stageId)
        .eq('status', 'pending');

      if (error) {
        console.error("❌ Error starting job:", error);
        throw error;
      }

      toast.success("Job started successfully");
      await fetchJobs();
      return true;
    } catch (err) {
      console.error('❌ Error starting job:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to start job";
      toast.error(errorMessage);
      return false;
    }
  };

  const completeJob = async (jobId: string, stageId: string) => {
    if (!user?.id) {
      toast.error("User not authenticated");
      return false;
    }

    try {
      console.log('✅ Completing job:', { jobId, stageId, userId: user.id });
      
      const { error } = await supabase.rpc('advance_job_stage', {
        p_job_id: jobId,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: stageId
      });

      if (error) {
        console.error("❌ Error completing job:", error);
        throw error;
      }

      toast.success("Job completed successfully");
      await fetchJobs();
      return true;
    } catch (err) {
      console.error('❌ Error completing job:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to complete job";
      toast.error(errorMessage);
      return false;
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (!user?.id) return;

    console.log("🔄 Setting up real-time subscription for accessible jobs");

    const channel = supabase
      .channel(`accessible_jobs_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_jobs',
        },
        (payload) => {
          console.log('📦 Production jobs changed - refetching', payload.eventType);
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
        (payload) => {
          console.log('🎯 Job stage instances changed - refetching', payload.eventType);
          fetchJobs();
        }
      )
      .subscribe((status) => {
        console.log("🔄 Real-time subscription status:", status);
      });

    return () => {
      console.log("🧹 Cleaning up accessible jobs real-time subscription");
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
