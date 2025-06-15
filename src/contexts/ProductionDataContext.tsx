
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

interface ProductionDataContextType {
  jobs: ProductionJob[];
  activeJobs: ProductionJob[];
  orphanedJobs: ProductionJob[];
  consolidatedStages: any[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
  getTimeSinceLastUpdate: () => string | null;
  subscribe: () => void;
  unsubscribe: () => void;
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
  lastUpdated: number | null;
} = { jobs: null, stages: null, lastUpdated: null };

export const ProductionDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [consolidatedStages, setConsolidatedStages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const subscriptionRef = useRef<any>(null);

  // --- SIMPLE CACHE-FIRST LOADING ---
  const fetchData = useCallback(async (force = false) => {
    if (!force && globalCache.jobs && globalCache.stages && globalCache.lastUpdated && (Date.now() - globalCache.lastUpdated < CACHE_TTL)) {
      setJobs(globalCache.jobs);
      setConsolidatedStages(globalCache.stages);
      setLastUpdated(new Date(globalCache.lastUpdated));
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      // --- Fetch jobs, categories, stages as in the current hook ---
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

      const jobIds = jobsData?.map(job => job.id) || [];
      let stagesData: any[] = [];
      if (jobIds.length > 0) {
        const { data: stagesDataRaw, error: stagesErr } = await supabase
          .from('job_stage_instances')
          .select(`
            *,
            production_stages (
              id, name, description, color, is_multi_part, master_queue_id, production_stages!master_queue_id ( name )
            )
          `)
          .in('job_id', jobIds)
          .eq('job_table_name', 'production_jobs')
          .order('stage_order', { ascending: true });

        if (stagesErr) throw stagesErr;
        stagesData = stagesDataRaw || [];
      }

      // For demo, we don't implement permissions logic in context: full jobs, stages
      // -- The following mirrors the status/orphan logic from `useUnifiedProductionData`
      const processedJobs: ProductionJob[] = (jobsData || []).map(job => {
        const jobStages = stagesData.filter(stage => stage.job_id === job.id);
        const hasWorkflow = jobStages.length > 0;
        const hasCategory = !!job.category_id;
        const isOrphaned = hasCategory && !hasWorkflow;
        const activeStage = jobStages.find(s => s.status === 'active');
        const pendingStages = jobStages.filter(s => s.status === 'pending');
        const completedStages = jobStages.filter(s => s.status === 'completed');
        let currentStage = job.status || 'Unknown';
        let currentStageId = null;
        let displayStageName = null;
        if (isOrphaned) {
          currentStage = 'Needs Repair';
          displayStageName = 'Category assigned but no workflow';
        } else if (activeStage) {
          currentStage = activeStage.production_stages?.name || 'Active Stage';
          currentStageId = activeStage.production_stage_id;
          const masterQueueName = activeStage.production_stages?.production_stages?.name;
          displayStageName = masterQueueName ? `${masterQueueName} - ${currentStage}` : currentStage;
        } else if (pendingStages.length > 0) {
          const firstPending = pendingStages.sort((a, b) => a.stage_order - b.stage_order)[0];
          currentStage = firstPending.production_stages?.name || 'Pending Stage';
          currentStageId = firstPending.production_stage_id;
          const masterQueueName = firstPending.production_stages?.production_stages?.name;
          displayStageName = masterQueueName ? `${masterQueueName} - ${currentStage}` : currentStage;
        } else if (hasWorkflow && completedStages.length === jobStages.length && jobStages.length > 0) {
          currentStage = 'Completed';
          displayStageName = 'Completed';
        } else if (!hasWorkflow && !hasCategory) {
          currentStage = job.status || 'DTP';
          displayStageName = currentStage;
        }
        const totalStages = jobStages.length;
        const workflowProgress = totalStages > 0 ? Math.round((completedStages.length / totalStages) * 100) : 0;
        return {
          id: job.id,
          wo_no: job.wo_no,
          customer: job.customer || 'Unknown Customer',
          status: job.status || currentStage,
          due_date: job.due_date,
          reference: job.reference,
          category_id: job.category_id,
          category_name: job.categories?.name || null,
          category_color: job.categories?.color || null,
          current_stage_id: currentStageId,
          current_stage_name: currentStage,
          current_stage_color: activeStage?.production_stages?.color || '#6B7280',
          display_stage_name: displayStageName,
          workflow_progress: workflowProgress,
          has_workflow: hasWorkflow,
          is_orphaned: isOrphaned,
          stages: jobStages.map(stage => ({
            ...stage,
            stage_name: stage.production_stages?.name || 'Unknown Stage',
            stage_color: stage.production_stages?.color || '#6B7280',
          })),
          job_stage_instances: jobStages,
          is_active: !!activeStage,
          is_pending: !activeStage && pendingStages.length > 0,
          is_completed: jobStages.length > 0 && completedStages.length === totalStages,
          stage_status: activeStage ? 'active' : (pendingStages.length > 0 ? 'pending' : 'unknown')
        };
      });

      const now = Date.now();
      globalCache = { jobs: processedJobs, stages: [], lastUpdated: now };

      setJobs(processedJobs);
      setConsolidatedStages([]); // TODO: fetch/fill if needed
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

  // Expose refresh function
  const refresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  // Real-time subscription only ONCE for the whole app
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

  useEffect(() => {
    fetchData(false);
    subscribe();
    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line
  }, []);

  // Active & orphaned jobs
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
      isLoading,
      isRefreshing,
      error,
      lastUpdated,
      refresh,
      getTimeSinceLastUpdate,
      subscribe,
      unsubscribe
    }}>
      {children}
    </ProductionDataContext.Provider>
  );
};
