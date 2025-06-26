
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

    try {
      // Check if user is admin first
      const { data: adminCheck } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      const isAdmin = adminCheck?.role === 'admin';

      let data;
      let fetchError;

      if (isAdmin) {
        // Admin gets all jobs
        const { data: adminData, error: adminError } = await supabase.rpc('get_user_accessible_jobs', {
          p_user_id: user.id,
          p_permission_type: 'manage',
          p_status_filter: statusFilter,
          p_stage_filter: stageFilter
        });

        data = adminData;
        fetchError = adminError;
      } else {
        // Regular user
        const { data: userData, error: userError } = await supabase.rpc('get_user_accessible_jobs', {
          p_user_id: user.id,
          p_permission_type: permissionType,
          p_status_filter: statusFilter,
          p_stage_filter: stageFilter
        });

        data = userData;
        fetchError = userError;
      }

      // Check if request was aborted
      if (abortController.signal.aborted) {
        throw new Error("Request was aborted");
      }

      if (fetchError) {
        throw new Error(`Failed to fetch jobs: ${fetchError.message}`);
      }

      if (data && Array.isArray(data)) {
        const normalizedJobs = data.map((job, index) => {
          return normalizeJobData(job, index);
        });

        return normalizedJobs;
      } else {
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
          setJobs(cachedData);
          setIsLoading(false);

          // If cache is stale, fetch in background
          if (jobsCache.isStale(cacheKey)) {
            setIsRefreshing(true);
          } else {
            return;
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
        return;
      }

      const errorMessage = err instanceof Error ? err.message : "Failed to load accessible jobs";
      
      // Only show error if we don't have cached data
      const cacheKey = getCacheKey();
      const hasCachedData = cacheKey && jobsCache.get(cacheKey);
      
      if (!hasCachedData) {
        setError(errorMessage);
        setJobs([]);
        toast.error(errorMessage);
      } else {
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
    () => fetchJobs(false),
    {
      onJobUpdate: (jobId, updateType) => {
        // Silent update - no console logging
      },
      batchDelay: 300
    }
  );

  // Refresh function that forces a fresh fetch and clears cache
  const refreshJobs = useCallback(async () => {
    console.log("🔄 Refreshing jobs with cache clear...");
    
    // Clear cache to ensure fresh data
    const cacheKey = getCacheKey();
    if (cacheKey) {
      jobsCache.clear(cacheKey);
    }
    
    // Force refresh from API
    await fetchJobs(true);
  }, [fetchJobs, getCacheKey]);

  // Force cache invalidation - useful after external changes like category assignments
  const invalidateCache = useCallback(() => {
    console.log("🗑️ Invalidating jobs cache...");
    const cacheKey = getCacheKey();
    if (cacheKey) {
      jobsCache.clear(cacheKey);
    }
  }, [getCacheKey]);

  useEffect(() => {
    if (!authLoading) {
      if (user?.id) {
        fetchJobs().catch(error => {
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
    invalidateCache, // New function to clear cache
    
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
