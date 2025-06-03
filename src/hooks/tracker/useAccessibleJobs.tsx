
import { useState, useCallback } from "react";
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
        const errorMessage = handleDatabaseError(fetchError);
        throw new Error(errorMessage);
      }

      console.log("✅ Raw database response:", data?.length, "jobs");

      // Validate and normalize the data to match our interface
      if (!Array.isArray(data)) {
        console.warn("⚠️ Database returned non-array data:", data);
        setJobs([]);
        return;
      }

      const normalizedJobs = data.map(normalizeJobData);

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

  const { startJob, completeJob } = useJobActions(fetchJobs);
  useRealtimeSubscription(fetchJobs);

  return {
    jobs,
    isLoading,
    error,
    startJob,
    completeJob,
    refreshJobs: fetchJobs
  };
};
