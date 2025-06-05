
import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { AccessibleJob, UseAccessibleJobsOptions } from "./useAccessibleJobs/types";
import { normalizeJobData } from "./useAccessibleJobs/jobDataNormalizer";
import { jobsCache } from "./useAccessibleJobs/cacheManager";
import { requestDeduplicator } from "./useAccessibleJobs/requestDeduplicator";

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
      
      // Invalidate cache and refresh
      const cacheKey = getCacheKey();
      if (cacheKey) {
        jobsCache.invalidateByPattern({ userId: user.id });
      }
      await fetchJobs(true);
      
      return true;
    } catch (err) {
      console.error('❌ Error starting job:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to start job";
      toast.error(errorMessage);
      return false;
    }
  }, [user?.id, getCacheKey, fetchJobs]);

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
      
      // Invalidate cache and refresh
      const cacheKey = getCacheKey();
      if (cacheKey) {
        jobsCache.invalidateByPattern({ userId: user.id });
      }
      await fetchJobs(true);
      
      return true;
    } catch (err) {
      console.error('❌ Error completing job:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to complete job";
      toast.error(errorMessage);
      return false;
    }
  }, [user?.id, getCacheKey, fetchJobs]);

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
    lastFetchTime,
    getCacheStats: () => jobsCache.getStats(),
    getRequestStats: () => requestDeduplicator.getStats()
  };
};

// Re-export the types for convenience
export type { AccessibleJob, UseAccessibleJobsOptions };
