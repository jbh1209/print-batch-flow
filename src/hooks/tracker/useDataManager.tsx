import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface CachedData {
  data: any[];
  timestamp: number;
  isStale: boolean;
}

interface DataManagerState {
  jobs: any[];
  stages: any[];
  isLoading: boolean;
  isRefreshing: boolean;
  lastUpdated: Date | null;
  error: string | null;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// --- NEW: Add a per-route/session cache (scoped by pathname) ---
const globalRouteCache: Record<string, { jobs: CachedData | null; stages: CachedData | null }> = {};

export const useDataManager = () => {
  const { user } = useAuth();
  const [state, setState] = useState<DataManagerState>({
    jobs: [],
    stages: [],
    isLoading: true,
    isRefreshing: false,
    lastUpdated: null,
    error: null
  });

  // --- Use route as cache key ---
  const routeKey = typeof window !== 'undefined' && window.location ? window.location.pathname : 'default-route-key';
  if (!globalRouteCache[routeKey]) {
    globalRouteCache[routeKey] = { jobs: null, stages: null };
  }
  const cacheRef = useRef(globalRouteCache[routeKey]);

  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isManualRefreshRef = useRef(false);

  const isCacheValid = useCallback((cache: CachedData | null): boolean => {
    if (!cache) return false;
    const now = Date.now();
    return (now - cache.timestamp) < CACHE_TTL;
  }, []);

  const fetchJobs = useCallback(async (): Promise<any[]> => {
    console.log('🔄 Fetching jobs from database...');
    
    const { data, error } = await supabase
      .from('production_jobs')
      .select(`
        *,
        categories (
          id,
          name,
          description,
          color,
          sla_target_days
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }, []);

  const fetchStages = useCallback(async (): Promise<any[]> => {
    console.log('🔄 Fetching stages from database...');
    
    const { data, error } = await supabase
      .from('production_stages')
      .select('*')
      .eq('is_active', true)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return data || [];
  }, []);

  // Enhanced function to group stages by master queue
  const groupStagesByMasterQueue = useCallback((stages: any[]) => {
    const masterQueues = new Map();
    const independentStages = [];

    // Process all stages to build master queue relationships
    stages.forEach(stage => {
      if (stage.master_queue_id) {
        // This stage belongs to a master queue
        const masterStage = stages.find(s => s.id === stage.master_queue_id);
        if (masterStage) {
          if (!masterQueues.has(stage.master_queue_id)) {
            masterQueues.set(stage.master_queue_id, {
              ...masterStage,
              subsidiaryStages: []
            });
          }
          masterQueues.get(stage.master_queue_id).subsidiaryStages.push(stage);
        }
      } else {
        // Check if this stage is a master queue for other stages
        const hasSubordinates = stages.some(s => s.master_queue_id === stage.id);
        if (hasSubordinates) {
          if (!masterQueues.has(stage.id)) {
            masterQueues.set(stage.id, {
              ...stage,
              subsidiaryStages: stages.filter(s => s.master_queue_id === stage.id)
            });
          }
        } else {
          // Independent stage
          independentStages.push(stage);
        }
      }
    });

    const result = {
      masterQueues: Array.from(masterQueues.values()),
      independentStages,
      // Flattened list for UI components that need all stages
      allStagesFlattened: stages,
      // Consolidated list showing master queues instead of individual stages
      consolidatedStages: [
        ...Array.from(masterQueues.values()),
        ...independentStages
      ]
    };

    console.log('🔗 Master Queue Grouping Result:', {
      masterQueues: result.masterQueues.length,
      independentStages: result.independentStages.length,
      totalOriginalStages: stages.length,
      consolidatedStages: result.consolidatedStages.length
    });

    return result;
  }, []);

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (!user?.id) return;

    isManualRefreshRef.current = isManualRefresh;
    
    try {
      setState(prev => ({
        ...prev,
        error: null,
        isLoading: !isManualRefresh && prev.jobs.length === 0,
        isRefreshing: isManualRefresh
      }));

      // Check cache first (unless manual refresh)
      if (!isManualRefresh) {
        const jobsCache = cacheRef.current.jobs;
        const stagesCache = cacheRef.current.stages;

        if (isCacheValid(jobsCache) && isCacheValid(stagesCache)) {
          console.log('📦 Using cached data');
          setState(prev => ({
            ...prev,
            jobs: jobsCache!.data,
            stages: stagesCache!.data,
            isLoading: false,
            isRefreshing: false,
            lastUpdated: new Date(jobsCache!.timestamp)
          }));
          return;
        }
      }

      // Fetch fresh data
      const [jobsData, stagesData] = await Promise.all([
        fetchJobs(),
        fetchStages()
      ]);

      const now = Date.now();
      
      // --- Update route-local cache
      cacheRef.current.jobs = { data: jobsData, timestamp: now, isStale: false };
      cacheRef.current.stages = { data: stagesData, timestamp: now, isStale: false };
      // Propagate to outer/global var for true route-sharing
      globalRouteCache[routeKey] = cacheRef.current;

      setState(prev => ({
        ...prev,
        jobs: jobsData,
        stages: stagesData,
        isLoading: false,
        isRefreshing: false,
        lastUpdated: new Date(now),
        error: null
      }));

      if (isManualRefresh) {
        toast.success('Data refreshed successfully');
      }

      console.log('✅ Data loaded successfully:', {
        jobs: jobsData.length,
        stages: stagesData.length,
        fromCache: false,
        routeKey
      });
    } catch (error) {
      console.error('❌ Error loading data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load data';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
        isRefreshing: false
      }));

      if (isManualRefresh) {
        toast.error('Failed to refresh data');
      }
    }
  }, [user?.id, fetchJobs, fetchStages, isCacheValid, routeKey]);

  const manualRefresh = useCallback(() => {
    console.log('🔄 Manual refresh triggered');
    // Always force a new fetch and replace this route's cache
    loadData(true);
  }, [loadData]);

  // Setup auto-refresh for this route
  useEffect(() => {
    if (!user?.id) return;
    // Initial load
    loadData(false);

    // Auto-refresh for this page (per route)
    autoRefreshIntervalRef.current = setInterval(() => {
      loadData(false);
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
      }
    };
  }, [user?.id, loadData, routeKey]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
      }
    };
  }, []);

  const getTimeSinceLastUpdate = useCallback(() => {
    if (!state.lastUpdated) return null;
    
    const now = new Date();
    const diffMs = now.getTime() - state.lastUpdated.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    return `${diffMins} minutes ago`;
  }, [state.lastUpdated]);

  return {
    jobs: state.jobs,
    stages: state.stages,
    isLoading: state.isLoading,
    isRefreshing: state.isRefreshing,
    lastUpdated: state.lastUpdated,
    error: state.error,
    manualRefresh,
    getTimeSinceLastUpdate,
    groupStagesByMasterQueue
  };
};
