
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

  const cacheRef = useRef<{
    jobs: CachedData | null;
    stages: CachedData | null;
  }>({
    jobs: null,
    stages: null
  });

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

  // New function to group stages by master queue
  const groupStagesByMasterQueue = useCallback((stages: any[]) => {
    const masterQueues = new Map();
    const independentStages = [];

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
              subsidiaryStages: []
            });
          }
        } else {
          // Independent stage
          independentStages.push(stage);
        }
      }
    });

    return {
      masterQueues: Array.from(masterQueues.values()),
      independentStages
    };
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
      
      // Update cache
      cacheRef.current.jobs = {
        data: jobsData,
        timestamp: now,
        isStale: false
      };
      
      cacheRef.current.stages = {
        data: stagesData,
        timestamp: now,
        isStale: false
      };

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
        fromCache: false
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
  }, [user?.id, fetchJobs, fetchStages, isCacheValid]);

  const manualRefresh = useCallback(() => {
    console.log('🔄 Manual refresh triggered');
    loadData(true);
  }, [loadData]);

  // Setup auto-refresh
  useEffect(() => {
    if (!user?.id) return;

    // Initial load
    loadData(false);

    // Setup auto-refresh interval
    autoRefreshIntervalRef.current = setInterval(() => {
      console.log('⏰ Auto-refresh triggered');
      loadData(false);
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
      }
    };
  }, [user?.id, loadData]);

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
