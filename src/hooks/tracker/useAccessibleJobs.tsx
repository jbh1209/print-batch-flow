
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
    permissionType = 'view',
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

      console.log("🔍 Fetching accessible jobs via database function...", {
        userId: user.id,
        permissionType,
        statusFilter,
        stageFilter
      });

      // Try the function call with better error handling
      const { data, error: fetchError } = await supabase.rpc('get_user_accessible_jobs', {
        p_user_id: user.id,
        p_permission_type: permissionType,
        p_status_filter: statusFilter,
        p_stage_filter: stageFilter
      });

      if (fetchError) {
        console.error("❌ Function call failed:", fetchError);
        throw new Error(`Database function failed: ${fetchError.message}`);
      }

      console.log("✅ Function call successful, raw data:", data?.length, "jobs");

      // Validate and normalize the data
      if (!Array.isArray(data)) {
        console.warn("⚠️ Database returned non-array data:", data);
        setJobs([]);
        return;
      }

      const normalizedJobs = data
        .filter(job => job && typeof job === 'object')
        .map((job, index) => {
          try {
            return normalizeJobData(job, index);
          } catch (jobError) {
            console.error(`❌ Error normalizing job at index ${index}:`, jobError);
            return null;
          }
        })
        .filter(job => job !== null) as AccessibleJob[];

      console.log("✅ Normalized accessible jobs:", normalizedJobs.length);
      setJobs(normalizedJobs);
      
    } catch (err) {
      console.error('❌ Error fetching accessible jobs:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load accessible jobs";
      setError(errorMessage);
      // Don't show toast for every error to avoid spam
      if (!error) {
        toast.error(errorMessage);
      }
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, permissionType, statusFilter, stageFilter, error]);

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
