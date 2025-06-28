import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { AccessibleJob } from "./types";
import { processJobsArray, RawJobData } from "./jobDataProcessor";

interface UseAccessibleJobsSimpleOptions {
  permissionType?: 'view' | 'edit' | 'work' | 'manage';
  statusFilter?: string | null;
  stageFilter?: string | null;
}

export const useAccessibleJobsSimple = (options: UseAccessibleJobsSimpleOptions = {}) => {
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
      setJobs([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      console.log("🔍 Fetching jobs with simplified approach:", {
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
        count: data?.length || 0,
        permissionType
      });

      if (data && Array.isArray(data)) {
        // Map the data to ensure it matches RawJobData interface
        const rawJobData: RawJobData[] = data.map(job => ({
          ...job,
          id: job.job_id || job.id || '', // Ensure id is present
        }));
        
        // Use centralized processor - this ensures custom workflow dates work consistently
        const processedJobs = processJobsArray(rawJobData);
        console.log("✅ Simplified jobs loaded with centralized processor:", processedJobs.length);
        setJobs(processedJobs);
      } else {
        console.log("⚠️ No valid data returned");
        setJobs([]);
      }
    } catch (err) {
      console.error('❌ Error fetching jobs:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load jobs";
      setError(errorMessage);
      setJobs([]);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, permissionType, statusFilter, stageFilter]);

  const startJob = useCallback(async (jobId: string): Promise<boolean> => {
    console.log("🚀 Starting job:", jobId);
    // Simple optimistic update
    setJobs(prev => prev.map(job => 
      job.job_id === jobId 
        ? { ...job, current_stage_status: 'active' }
        : job
    ));
    
    // Refresh data after action
    setTimeout(() => fetchJobs(), 500);
    toast.success("Job started");
    return true;
  }, [fetchJobs]);

  const completeJob = useCallback(async (jobId: string): Promise<boolean> => {
    console.log("✅ Completing job:", jobId);
    // Simple optimistic update
    setJobs(prev => prev.map(job => 
      job.job_id === jobId 
        ? { ...job, current_stage_status: 'completed' }
        : job
    ));
    
    // Refresh data after action
    setTimeout(() => fetchJobs(), 500);
    toast.success("Job completed");
    return true;
  }, [fetchJobs]);

  useEffect(() => {
    if (!authLoading && user?.id) {
      fetchJobs();
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
