import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ---- Data type (mirror what useUnifiedProductionData returns) ---
export interface ProductionJob {
  id: string;
  wo_no: string;
  customer: string;
  status: string;
  due_date?: string;
  reference?: string;
  category_id?: string;
  category_name?: string;
  category_color?: string;
  current_stage_id?: string;
  current_stage_name?: string;
  current_stage_color?: string;
  display_stage_name?: string;
  workflow_progress?: number;
  has_workflow: boolean;
  is_orphaned: boolean;
  stages: any[];
  job_stage_instances: any[];
  is_active: boolean;
  is_pending: boolean;
  is_completed: boolean;
  stage_status: string;
}

export interface JobStageInstance {
  id: string;
  job_id: string;
  job_table_name: string;
  production_stage_id: string;
  category_id?: string;
  stage_order: number;
  status: 'pending' | 'active' | 'completed' | 'skipped' | 'reworked';
  started_at?: string;
  completed_at?: string;
  started_by?: string;
  completed_by?: string;
  notes?: string;
  part_name?: string;
  job_order_in_stage: number;
  rework_count: number;
  is_rework: boolean;
  created_at: string;
  updated_at: string;
  production_stages?: {
    id: string;
    name: string;
    color: string;
    description?: string;
    is_multi_part: boolean;
    master_queue_id?: string;
    production_stages?: {
      name: string;
      color: string;
    };
  };
}

interface ProductionDataContextType {
  jobs: ProductionJob[];
  activeJobs: ProductionJob[];
  orphanedJobs: ProductionJob[];
  consolidatedStages: any[];
  stages: any[];
  jobStages: JobStageInstance[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
  getTimeSinceLastUpdate: () => string | null;
  subscribe: () => void;
  unsubscribe: () => void;
  // Kanban-specific actions
  startStage: (stageId: string) => Promise<void>;
  completeStage: (stageId: string) => Promise<void>;
  getStageMetrics: () => {
    uniqueJobs: number;
    activeStages: number;
    pendingStages: number;
  };
}

// ---- CONTEXT ----
const ProductionDataContext = createContext<ProductionDataContextType | undefined>(undefined);

export const useProductionDataContext = () => {
  const ctx = useContext(ProductionDataContext);
  if (!ctx) throw new Error("useProductionDataContext must be used within ProductionDataProvider");
  return ctx;
};

// ---- PROVIDER ----
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let globalCache: {
  jobs: ProductionJob[] | null;
  stages: any[] | null;
  jobStages: JobStageInstance[] | null;
  lastUpdated: number | null;
  consolidatedStages: any[] | null;
} = { jobs: null, stages: null, jobStages: null, lastUpdated: null, consolidatedStages: null };

export const ProductionDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [jobStages, setJobStages] = useState<JobStageInstance[]>([]);
  const [consolidatedStages, setConsolidatedStages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const subscriptionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper: Consolidate stages into master/subsidiaries groups and REMOVE "Pre-Press" if present
  const consolidateStages = (allStages: any[]) => {
    const masterQueueMap: { [id: string]: any } = {};
    const result: any[] = [];

    allStages?.forEach(stage => {
      if (!stage.is_active) return; // Only include active stages

      // REMOVE hardcoded/pre-existing "Pre-Press"
      if (stage.name === "Pre-Press") return;

      if (stage.master_queue_id && stage.master_queue_id !== stage.id) {
        // Subsidiary stage
        if (!masterQueueMap[stage.master_queue_id]) {
          // Find the master stage
          const master = allStages.find(s => s.id === stage.master_queue_id);
          masterQueueMap[stage.master_queue_id] = {
            stage_id: master?.id || stage.master_queue_id,
            stage_name: master?.name || "Master Queue",
            stage_color: master?.color || "#9CA3AF",
            is_master_queue: true,
            subsidiary_stages: [],
          };
          result.push(masterQueueMap[stage.master_queue_id]);
        }
        masterQueueMap[stage.master_queue_id].subsidiary_stages.push({
          stage_id: stage.id,
          stage_name: stage.name,
          stage_color: stage.color,
        });
      } else {
        // Standalone or master
        result.push({
          stage_id: stage.id,
          stage_name: stage.name,
          stage_color: stage.color,
          is_master_queue: false,
          subsidiary_stages: [],
        });
      }
    });

    // Remove duplicates for pure masters
    return result.filter(
      (stage, idx, arr) =>
        arr.findIndex(s => s.stage_id === stage.stage_id) === idx
    );
  };

  const fetchData = useCallback(async (force = false) => {
    if (
      !force &&
      globalCache.jobs &&
      globalCache.stages &&
      globalCache.jobStages &&
      globalCache.lastUpdated &&
      (Date.now() - globalCache.lastUpdated < CACHE_TTL) &&
      globalCache.consolidatedStages
    ) {
      setJobs(globalCache.jobs);
      setStages(globalCache.stages);
      setJobStages(globalCache.jobStages);
      setConsolidatedStages(globalCache.consolidatedStages);
      setLastUpdated(new Date(globalCache.lastUpdated));
      setIsLoading(false);
      setError(null);
      return;
    }
    
    if (force) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      // Fetch jobs, categories, stages, and job stage instances
      const { data: jobsData, error: jobsError } = await supabase
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

      if (jobsError) throw jobsError;

      // Fetch all available production_stages
      const { data: allStages, error: allStagesErr } = await supabase
        .from('production_stages')
        .select('*')
        .order('order_index', { ascending: true });
      if (allStagesErr) throw allStagesErr;

      // Fetch job stage instances
      const jobIds = jobsData?.map(job => job.id) || [];
      let jobStagesData: JobStageInstance[] = [];
      
      if (jobIds.length > 0) {
        const { data: stagesDataRaw, error: stagesErr } = await supabase
          .from('job_stage_instances')
          .select(`
            *,
            production_stages (
              id, name, description, color, is_multi_part, master_queue_id, 
              production_stages!master_queue_id ( name, color )
            )
          `)
          .in('job_id', jobIds)
          .eq('job_table_name', 'production_jobs')
          .order('stage_order', { ascending: true });

        if (stagesErr) throw stagesErr;
        
        // Properly map and type the job stages data
        jobStagesData = (stagesDataRaw || []).map(stage => ({
          ...stage,
          status: ['pending', 'active', 'completed', 'skipped', 'reworked'].includes(stage.status) 
            ? stage.status as 'pending' | 'active' | 'completed' | 'skipped' | 'reworked'
            : 'pending'
        }));
      }

      // Consolidate production stages
      const consolidated = consolidateStages(allStages || []);

      // SIMPLIFIED job processing - preserve original data
      const processedJobs: ProductionJob[] = (jobsData || []).map(job => {
        const jobStages = jobStagesData.filter(stage => stage.job_id === job.id);
        const hasWorkflow = jobStages.length > 0;
        const activeStage = jobStages.find(s => s.status === 'active');
        const pendingStages = jobStages.filter(s => s.status === 'pending');
        const completedStages = jobStages.filter(s => s.status === 'completed');
        
        // Use original job data directly
        return {
          id: job.id,
          wo_no: job.wo_no || '',
          customer: job.customer || '',
          status: job.status || 'Pre-Press',
          due_date: job.due_date,
          reference: job.reference || '',
          category_id: job.category_id,
          category_name: job.categories?.name || null,
          category_color: job.categories?.color || null,
          current_stage_id: activeStage?.production_stage_id || null,
          current_stage_name: activeStage?.production_stages?.name || job.status || 'Pre-Press',
          current_stage_color: activeStage?.production_stages?.color || '#6B7280',
          display_stage_name: activeStage?.production_stages?.name || job.status || 'Pre-Press',
          workflow_progress: hasWorkflow && jobStages.length > 0 ? Math.round((completedStages.length / jobStages.length) * 100) : 0,
          has_workflow: hasWorkflow,
          is_orphaned: false, // Simplified - no complex orphaned logic
          stages: jobStages.map(stage => ({
            ...stage,
            stage_name: stage.production_stages?.name || 'Unknown Stage',
            stage_color: stage.production_stages?.color || '#6B7280',
          })),
          job_stage_instances: jobStages,
          is_active: !!activeStage,
          is_pending: !activeStage && pendingStages.length > 0,
          is_completed: hasWorkflow && jobStages.length > 0 && completedStages.length === jobStages.length,
          stage_status: activeStage ? 'active' : (pendingStages.length > 0 ? 'pending' : 'unknown')
        };
      });

      const now = Date.now();
      globalCache = {
        jobs: processedJobs,
        stages: allStages || [],
        jobStages: jobStagesData,
        lastUpdated: now,
        consolidatedStages: consolidated
      };

      setJobs(processedJobs);
      setStages(allStages || []);
      setJobStages(jobStagesData);
      setConsolidatedStages(consolidated);
      setLastUpdated(new Date(now));
      setError(null);
      setIsLoading(false);
      setIsRefreshing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load production data");
      setIsLoading(false);
      setIsRefreshing(false);
      toast.error("Failed to load production data");
    }
  }, []);

  const startStage = useCallback(async (stageId: string) => {
    try {
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageId);

      if (error) throw error;
      
      // Refresh data after action
      fetchData(true);
    } catch (err) {
      console.error('Error starting stage:', err);
      toast.error('Failed to start stage');
    }
  }, [fetchData]);

  const completeStage = useCallback(async (stageId: string) => {
    try {
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageId);

      if (error) throw error;
      
      // Refresh data after action
      fetchData(true);
    } catch (err) {
      console.error('Error completing stage:', err);
      toast.error('Failed to complete stage');
    }
  }, [fetchData]);

  const getStageMetrics = useCallback(() => {
    const uniqueJobs = new Set(jobStages.map(js => js.job_id)).size;
    const activeStages = jobStages.filter(js => js.status === 'active').length;
    const pendingStages = jobStages.filter(js => js.status === 'pending').length;
    
    return {
      uniqueJobs,
      activeStages,
      pendingStages
    };
  }, [jobStages]);

  // Expose refresh function
  const refresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  // Real-time subscription
  const subscribe = () => {
    if (subscriptionRef.current) return;
    const channel = supabase
      .channel("global_production_data")
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_jobs' }, () => {
        fetchData(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_stage_instances' }, () => {
        fetchData(true);
      })
      .subscribe();
    subscriptionRef.current = channel;
  };
  
  const unsubscribe = () => {
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }
  };

  // Setup timer for 5-minute refresh
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      fetchData(true);
    }, CACHE_TTL);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [fetchData]);

  useEffect(() => {
    fetchData(false);
    subscribe();
    return () => {
      unsubscribe();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
    // eslint-disable-next-line
  }, []);

  const activeJobs = jobs.filter(job => job.status !== 'Completed' && !job.is_completed);
  const orphanedJobs = jobs.filter(job => job.is_orphaned);

  const getTimeSinceLastUpdate = () => {
    if (!lastUpdated) return null;
    const now = new Date();
    const ms = now.getTime() - lastUpdated.getTime();
    const mins = Math.floor(ms / (1000 * 60));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <ProductionDataContext.Provider value={{
      jobs,
      activeJobs,
      orphanedJobs,
      consolidatedStages,
      stages,
      jobStages,
      isLoading,
      isRefreshing,
      error,
      lastUpdated,
      refresh,
      getTimeSinceLastUpdate,
      subscribe,
      unsubscribe,
      startStage,
      completeStage,
      getStageMetrics
    }}>
      {children}
    </ProductionDataContext.Provider>
  );
};

export default ProductionDataContext.Provider;
