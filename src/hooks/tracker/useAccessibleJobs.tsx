
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

      // Try the database function with better error handling
      const { data: dbFunctionData, error: functionError } = await supabase.rpc('get_user_accessible_jobs', {
        p_user_id: user.id,
        p_permission_type: permissionType,
        p_status_filter: statusFilter,
        p_stage_filter: stageFilter
      });

      if (functionError) {
        console.error("❌ Database function error:", functionError);
        
        // Handle specific error types more gracefully
        if (functionError.message?.includes('ambiguous')) {
          setError("Database query error. Please refresh the page or contact support.");
        } else if (functionError.message?.includes('permission')) {
          setError("You don't have permission to access this data.");
        } else {
          setError(handleDatabaseError(functionError));
        }
        
        setJobs([]);
        return;
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
          .map((job, index) => {
            try {
              return normalizeJobData(job, index);
            } catch (normalizationError) {
              console.warn(`Failed to normalize job at index ${index}:`, normalizationError);
              return null;
            }
          })
          .filter(job => job !== null) as AccessibleJob[];

        console.log("✅ Normalized jobs:", normalizedJobs.length);
        setJobs(normalizedJobs);
      } else {
        console.log("⚠️ No valid data returned from database function");
        setJobs([]);
      }
      
    } catch (err) {
      console.error('❌ Error in fetchJobs:', err);
      
      const errorMessage = err instanceof Error 
        ? err.message 
        : "Failed to load accessible jobs. Please try again.";
      
      setError(errorMessage);
      setJobs([]);
      
      // Only show toast for unexpected errors, not permission/auth issues
      if (!errorMessage.includes('permission') && !errorMessage.includes('authentication')) {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, permissionType, statusFilter, stageFilter]);

  const { startJob, completeJob } = useJobActions(fetchJobs);
  
  // Only set up realtime if we have jobs data
  useRealtimeSubscription(fetchJobs);

  // Initial data load with better error boundaries
  useEffect(() => {
    console.log("🔄 useAccessibleJobs effect triggered", {
      authLoading,
      userId: user?.id
    });
    
    if (!authLoading && user?.id) {
      fetchJobs().catch(error => {
        console.error("Failed to fetch jobs in effect:", error);
        setError("Failed to load jobs on initial load");
        setIsLoading(false);
      });
    } else if (!authLoading && !user?.id) {
      setIsLoading(false);
      setJobs([]);
      setError(null);
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
