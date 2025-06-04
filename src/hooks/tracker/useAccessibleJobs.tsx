
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { normalizeJobData } from "./useAccessibleJobs/jobDataNormalizer";
import { handleDatabaseError } from "./useAccessibleJobs/errorHandler";
import { useJobActions } from "./useAccessibleJobs/useJobActions";
import { useRealtimeSubscription } from "./useAccessibleJobs/useRealtimeSubscription";
import type { AccessibleJob, UseAccessibleJobsOptions } from "./useAccessibleJobs/types";

export type { AccessibleJob, UseAccessibleJobsOptions };

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

      // Try the database function
      const { data: dbFunctionData, error: functionError } = await supabase.rpc('get_user_accessible_jobs', {
        p_user_id: user.id,
        p_permission_type: permissionType,
        p_status_filter: statusFilter,
        p_stage_filter: stageFilter
      });

      if (functionError) {
        console.error("❌ Database function error:", functionError);
        throw new Error(handleDatabaseError(functionError));
      }

      console.log("✅ Database function success:", {
        count: dbFunctionData?.length || 0,
        sample: dbFunctionData?.slice(0, 3).map(job => ({
          wo_no: job.wo_no,
          current_stage_name: job.current_stage_name,
          current_stage_status: job.current_stage_status,
          user_can_work: job.user_can_work
        })) || []
      });

      if (dbFunctionData && Array.isArray(dbFunctionData)) {
        const normalizedJobs = dbFunctionData
          .filter(job => job && typeof job === 'object')
          .map((job, index) => normalizeJobData(job, index))
          .filter(job => job !== null) as AccessibleJob[];

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

  const { startJob, completeJob } = useJobActions(fetchJobs);
  
  // Only set up realtime if we have jobs data
  useRealtimeSubscription(fetchJobs);

  // Initial data load
  useEffect(() => {
    console.log("🔄 useAccessibleJobs effect triggered", {
      authLoading,
      userId: user?.id
    });
    
    if (!authLoading && user?.id) {
      fetchJobs();
    } else if (!authLoading && !user?.id) {
      setIsLoading(false);
      setJobs([]);
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
