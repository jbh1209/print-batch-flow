
import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { AccessibleJob, UseAccessibleJobsOptions } from "./useAccessibleJobs/types";
import { normalizeJobData } from "./useAccessibleJobs/jobDataNormalizer";
import { jobsCache } from "./useAccessibleJobs/cacheManager";
import { requestDeduplicator } from "./useAccessibleJobs/requestDeduplicator";
import { useRealtimeSubscription } from "./useAccessibleJobs/useRealtimeSubscription";
import { useJobActions } from "./useAccessibleJobs/useJobActions";

export const useAccessibleJobs = (options: UseAccessibleJobsOptions = {}) => {
  const { user, isLoading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<AccessibleJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    permissionType = 'work',
    statusFilter = null,
    stageFilter = null
  } = options;

  // Create cache key from current parameters
  const getCacheKey = useCallback(() => {
    if (!user?.id) return null;
    return {
      userId: user.id,
      permissionType,
      statusFilter,
      stageFilter
    };
  }, [user?.id, permissionType, statusFilter, stageFilter]);

  const fetchJobsFromAPI = useCallback(async (): Promise<AccessibleJob[]> => {
    if (!user?.id) {
      throw new Error("No user ID available");
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    console.log("🔍 Fetching accessible jobs from API with params:", {
      userId: user.id,
      permissionType,
      statusFilter,
      stageFilter
    });

    try {
      const { data, error: fetchError } = await supabase.rpc('get_user_accessible_jobs', {
        p_user_id: user.id,
        p_permission_type: permissionType,
        p_status_filter: statusFilter,
        p_stage_filter: stageFilter
      });

      // Check if request was aborted
      if (abortController.signal.aborted) {
        throw new Error("Request was aborted");
      }

      if (fetchError) {
        console.error("❌ Database function error:", fetchError);
        throw new Error(`Failed to fetch jobs: ${fetchError.message}`);
      }

      console.log("✅ Database function success:", {
        count: data?.length || 0
      });

      if (data && Array.isArray(data)) {
        const normalizedJobs = data.map((job, index) => {
          return normalizeJobData(job, index);
        });

        console.log("✅ Normalized jobs:", normalizedJobs.length);
        return normalizedJobs;
      } else {
        console.log("⚠️ No valid data returned from database function");
        return [];
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, [user?.id, permissionType, statusFilter, stageFilter]);

  const fetchJobs = useCallback(async (forceRefresh = false) => {
    const cacheKey = getCacheKey();
    if (!cacheKey) {
      console.log("❌ No cache key available, skipping fetch");
      setJobs([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      setError(null);

      // Check cache first (unless forcing refresh)
      if (!forceRefresh) {
        const cachedData = jobsCache.get(cacheKey);
        if (cachedData) {
          console.log("📦 Using cached data, count:", cachedData.length);
          setJobs(cachedData);
          setIsLoading(false);

          // If cache is stale, fetch in background
          if (jobsCache.isStale(cacheKey)) {
            console.log("🔄 Cache is stale, fetching fresh data in background");
            setIsRefreshing(true);
          } else {
            return; // Fresh cache, no need to fetch
          }
        } else {
          setIsLoading(true);
        }
      } else {
        setIsLoading(true);
      }

      // Deduplicate the request
      const freshJobs = await requestDeduplicator.deduplicate(
        cacheKey,
        fetchJobsFromAPI
      );

      // Update cache
      jobsCache.set(cacheKey, freshJobs);
      
      // Update state
      setJobs(freshJobs);
      setLastFetchTime(Date.now());
      
    } catch (err) {
      if (err instanceof Error && err.message === "Request was aborted") {
        console.log("🚫 Request was aborted");
        return;
      }

      console.error('❌ Error in fetchJobs:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load accessible jobs";
      
      // Only show error if we don't have cached data
      const cacheKey = getCacheKey();
      const hasCachedData = cacheKey && jobsCache.get(cacheKey);
      
      if (!hasCachedData) {
        setError(errorMessage);
        setJobs([]);
        toast.error(errorMessage);
      } else {
        console.log("⚠️ Using cached data due to fetch error:", errorMessage);
        toast.warning("Using cached data - connection issue");
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [getCacheKey, fetchJobsFromAPI]);

  // Handle optimistic updates
  const handleOptimisticUpdate = useCallback((jobId: string, updates: Partial<AccessibleJob>) => {
    setJobs(prevJobs => 
      prevJobs.map(job => 
        job.job_id === jobId ? { ...job, ...updates } : job
      )
    );
  }, []);

  const handleOptimisticRevert = useCallback((jobId: string, field: keyof AccessibleJob, originalValue: any) => {
    setJobs(prevJobs => 
      prevJobs.map(job => 
        job.job_id === jobId ? { ...job, [field]: originalValue } : job
      )
    );
  }, []);

  // Set up job actions with optimistic updates
  const { startJob, completeJob, optimisticUpdates, hasOptimisticUpdates } = useJobActions(
    () => fetchJobs(true),
    {
      onOptimisticUpdate: handleOptimisticUpdate,
      onOptimisticRevert: handleOptimisticRevert
    }
  );

  // Set up enhanced real-time subscription
  const { forceUpdate, hasPendingUpdates } = useRealtimeSubscription(
    () => fetchJobs(false), // Use background refresh for real-time updates
    {
      onJobUpdate: (jobId, updateType) => {
        console.log(`🔔 Real-time update for job ${jobId}: ${updateType}`);
      },
      batchDelay: 300 // Shorter delay for real-time feel
    }
  );

  // Refresh function that forces a fresh fetch
  const refreshJobs = useCallback(async () => {
    await fetchJobs(true);
  }, [fetchJobs]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    jobs,
    isLoading: isLoading || authLoading,
    isRefreshing,
    error,
    startJob,
    completeJob,
    refreshJobs,
    forceUpdate,
    lastFetchTime,
    
    // Enhanced capabilities
    hasOptimisticUpdates,
    hasPendingUpdates,
    optimisticUpdates,
    
    // Debug utilities
    getCacheStats: () => jobsCache.getStats(),
    getRequestStats: () => requestDeduplicator.getStats()
  };
};

// Re-export the types for convenience
export type { AccessibleJob, UseAccessibleJobsOptions };
