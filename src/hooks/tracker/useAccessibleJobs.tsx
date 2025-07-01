
import { useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { AccessibleJob, UseAccessibleJobsOptions } from "./useAccessibleJobs/types";

export const useAccessibleJobs = ({ 
  permissionType = 'work', 
  statusFilter = null 
}: UseAccessibleJobsOptions = {}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const {
    data: rawJobs = [],
    isLoading,
    error,
    refetch,
    dataUpdatedAt
  } = useQuery({
    queryKey: ['accessible-jobs', user?.id, permissionType, statusFilter],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      console.log('🔄 Fetching accessible jobs with params:', {
        userId: user.id,
        permissionType,
        statusFilter
      });

      const { data, error } = await supabase.rpc('get_user_accessible_jobs', {
        p_user_id: user.id,
        p_permission_type: permissionType,
        p_status_filter: statusFilter,
        p_stage_filter: null
      });

      if (error) {
        console.error('❌ Error fetching accessible jobs:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 30000,
    refetchOnWindowFocus: true,
    refetchInterval: 60000
  });

  // Enhanced job processing to handle batch processing status
  const jobs: AccessibleJob[] = useMemo(() => {
    if (!rawJobs || rawJobs.length === 0) return [];

    return rawJobs.map(job => {
      // Handle batch processing status display
      let displayStage = job.current_stage_name || job.display_stage_name || 'No Stage';
      let stageColor = job.current_stage_color || '#6B7280';
      
      // Special handling for "In Batch Processing" status
      if (job.status === 'In Batch Processing') {
        displayStage = 'In Batch Processing';
        stageColor = '#F59E0B'; // Orange color for batch processing
      }

      return {
        job_id: job.job_id,
        id: job.job_id, // Ensure backward compatibility
        wo_no: job.wo_no || '',
        customer: job.customer || 'Unknown',
        status: job.status || 'Unknown',
        due_date: job.due_date || '',
        reference: job.reference || '',
        category_id: job.category_id || '',
        category_name: job.category_name || 'No Category',
        category_color: job.category_color || '#6B7280',
        current_stage_id: job.current_stage_id || '',
        current_stage_name: job.current_stage_name || 'No Stage',
        current_stage_color: stageColor,
        current_stage_status: job.current_stage_status || 'pending',
        display_stage_name: displayStage,
        user_can_view: job.user_can_view || false,
        user_can_edit: job.user_can_edit || false,
        user_can_work: job.user_can_work || false,
        user_can_manage: job.user_can_manage || false,
        workflow_progress: job.workflow_progress || 0,
        total_stages: job.total_stages || 0,
        completed_stages: job.completed_stages || 0,
        qty: job.qty || 0,
        started_by: job.started_by || null,
        started_by_name: job.started_by_name || null,
        proof_emailed_at: job.proof_emailed_at || null,
        // Add batch-related fields - use safe property access
        batch_category: (job as any).batch_category || null,
        is_in_batch_processing: job.status === 'In Batch Processing',
        has_custom_workflow: (job as any).has_custom_workflow || false,
        manual_due_date: (job as any).manual_due_date || null
      };
    });
  }, [rawJobs]);

  const startJob = useCallback(async (jobId: string, stageId?: string): Promise<boolean> => {
    try {
      console.log('🔄 Starting job stage:', { jobId, stageId });

      if (!stageId) {
        const job = jobs.find(j => j.job_id === jobId);
        stageId = job?.current_stage_id;
      }

      if (!stageId) {
        throw new Error('Stage ID is required to start job');
      }

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

      await refreshJobs();
      return true;
    } catch (error) {
      console.error('❌ Error starting job:', error);
      return false;
    }
  }, [jobs, user?.id]);

  const completeJob = useCallback(async (jobId: string, stageId?: string): Promise<boolean> => {
    try {
      console.log('🔄 Completing job stage:', { jobId, stageId });

      if (!stageId) {
        const job = jobs.find(j => j.job_id === jobId);
        stageId = job?.current_stage_id;
      }

      if (!stageId) {
        throw new Error('Stage ID is required to complete job');
      }

      const { error } = await supabase.rpc('advance_job_stage', {
        p_job_id: jobId,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: stageId,
        p_completed_by: user?.id
      });

      if (error) throw error;

      await refreshJobs();
      return true;
    } catch (error) {
      console.error('❌ Error completing job:', error);
      return false;
    }
  }, [jobs, user?.id]);

  const refreshJobs = useCallback(() => {
    console.log('🔄 Refreshing accessible jobs...');
    return refetch();
  }, [refetch]);

  const invalidateCache = useCallback(() => {
    console.log('🗑️ Invalidating accessible jobs cache...');
    queryClient.invalidateQueries({ 
      queryKey: ['accessible-jobs', user?.id] 
    });
  }, [queryClient, user?.id]);

  return {
    jobs,
    isLoading,
    error: error?.message || null,
    startJob,
    completeJob,
    refreshJobs,
    invalidateCache,
    hasOptimisticUpdates: false,
    hasPendingUpdates: () => false,
    lastFetchTime: dataUpdatedAt
  };
};

// Re-export types for compatibility
export type { AccessibleJob } from "./useAccessibleJobs/types";
