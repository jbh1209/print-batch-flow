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
  consolidatedStages: any[] | null;
} = { jobs: null, stages: null, lastUpdated: null, consolidatedStages: null };

export const ProductionDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [consolidatedStages, setConsolidatedStages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const subscriptionRef = useRef<any>(null);

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

  // Helper: Consolidate job stage instances for a single job - FIXED VERSION
  const consolidateJobStages = (jobStages: any[]) => {
    console.log('🔍 Consolidating job stages:', jobStages.length, 'raw stages');
    
    // Group stages by production_stage_id and stage_order to handle both single and multi-part correctly
    const stageGroups = new Map();
    
    jobStages.forEach(stage => {
      // Create a unique key that combines production_stage_id and stage_order
      // This ensures we don't accidentally merge different stages
      const groupKey = `${stage.production_stage_id}_${stage.stage_order}`;
      
      if (!stageGroups.has(groupKey)) {
        // Initialize the group with the first stage instance
        stageGroups.set(groupKey, {
          ...stage,
          parts: [],
          consolidated_status: stage.status,
          all_parts_completed: false,
          any_part_active: false,
          any_part_pending: false
        });
      }
      
      const group = stageGroups.get(groupKey);
      
      // If this stage has part_name, it's a multi-part stage
      if (stage.part_name) {
        group.parts.push({
          part_name: stage.part_name,
          status: stage.status,
          part_order: stage.part_order,
          started_at: stage.started_at,
          completed_at: stage.completed_at,
          notes: stage.notes
        });
        
        // Update consolidated status based on part statuses
        if (stage.status === 'active') {
          group.any_part_active = true;
          group.consolidated_status = 'active';
        } else if (stage.status === 'pending' && group.consolidated_status !== 'active') {
          group.any_part_pending = true;
          if (group.consolidated_status !== 'active') {
            group.consolidated_status = 'pending';
          }
        }
      }
      
      // Update timestamps to reflect the most recent activity
      if (stage.started_at && (!group.started_at || new Date(stage.started_at) > new Date(group.started_at))) {
        group.started_at = stage.started_at;
        group.started_by = stage.started_by;
      }
      
      if (stage.completed_at && (!group.completed_at || new Date(stage.completed_at) > new Date(group.completed_at))) {
        group.completed_at = stage.completed_at;
        group.completed_by = stage.completed_by;
      }
    });
    
    // Convert map to array and check completion status for multi-part stages
    const consolidatedStages = Array.from(stageGroups.values()).map(group => {
      // For multi-part stages, check if all parts are completed
      if (group.parts.length > 0) {
        const allPartsCompleted = group.parts.every(part => part.status === 'completed');
        const anyPartActive = group.parts.some(part => part.status === 'active');
        const anyPartPending = group.parts.some(part => part.status === 'pending');
        
        if (allPartsCompleted) {
          group.consolidated_status = 'completed';
          group.all_parts_completed = true;
        } else if (anyPartActive) {
          group.consolidated_status = 'active';
        } else if (anyPartPending) {
          group.consolidated_status = 'pending';
        }
      }
      
      return group;
    });
    
    // Sort by stage_order to maintain workflow sequence
    const sortedStages = consolidatedStages.sort((a, b) => a.stage_order - b.stage_order);
    
    console.log('✅ Consolidated to', sortedStages.length, 'unique stages');
    console.log('📋 Stage details:', sortedStages.map(s => ({ 
      name: s.production_stages?.name, 
      order: s.stage_order, 
      status: s.consolidated_status,
      parts: s.parts.length 
    })));
    
    return sortedStages;
  };

  const fetchData = useCallback(async (force = false) => {
    if (
      !force &&
      globalCache.jobs &&
      globalCache.stages &&
      globalCache.lastUpdated &&
      (Date.now() - globalCache.lastUpdated < CACHE_TTL) &&
      globalCache.consolidatedStages
    ) {
      setJobs(globalCache.jobs);
      setConsolidatedStages(globalCache.consolidatedStages);
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
              id, name, description, color, is_multi_part, master_queue_id, production_stages!master_queue_id ( name, color )
            )
          `)
          .in('job_id', jobIds)
          .eq('job_table_name', 'production_jobs')
          .order('stage_order', { ascending: true });

        if (stagesErr) throw stagesErr;
        stagesData = stagesDataRaw || [];
      }

      // Fetch all available production_stages for sidebar display (regardless of usage in jobs)
      const { data: allStages, error: allStagesErr } = await supabase
        .from('production_stages')
        .select('*');
      if (allStagesErr) throw allStagesErr;

      // Consolidate production stages
      const consolidated = consolidateStages(allStages || []);

      const processedJobs: ProductionJob[] = (jobsData || []).map(job => {
        const jobStages = stagesData.filter(stage => stage.job_id === job.id);
        const hasWorkflow = jobStages.length > 0;
        const hasCategory = !!job.category_id;
        const isOrphaned = hasCategory && !hasWorkflow;
        
        // Use consolidated stages for better display
        const consolidatedJobStages = consolidateJobStages(jobStages);
        
        const activeStage = consolidatedJobStages.find(s => s.consolidated_status === 'active');
        const pendingStages = consolidatedJobStages.filter(s => s.consolidated_status === 'pending');
        const completedStages = consolidatedJobStages.filter(s => s.consolidated_status === 'completed');
        
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
        } else if (hasWorkflow && completedStages.length === consolidatedJobStages.length && consolidatedJobStages.length > 0) {
          currentStage = 'Completed';
          displayStageName = 'Completed';
        } else if (!hasWorkflow && !hasCategory) {
          currentStage = job.status || 'DTP';
          displayStageName = currentStage;
        }
        
        const totalStages = consolidatedJobStages.length;
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
          stages: consolidatedJobStages.map(stage => ({
            ...stage,
            stage_name: stage.production_stages?.name || 'Unknown Stage',
            stage_color: stage.production_stages?.color || '#6B7280',
            status: stage.consolidated_status, // Use consolidated status for display
          })),
          job_stage_instances: jobStages,
          is_active: !!activeStage,
          is_pending: !activeStage && pendingStages.length > 0,
          is_completed: consolidatedJobStages.length > 0 && completedStages.length === totalStages,
          stage_status: activeStage ? 'active' : (pendingStages.length > 0 ? 'pending' : 'unknown')
        };
      });

      const now = Date.now();
      globalCache = {
        jobs: processedJobs,
        stages: allStages,
        lastUpdated: now,
        consolidatedStages: consolidated
      };

      setJobs(processedJobs);
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
      activeJobs: jobs.filter(job => job.status !== 'Completed' && !job.is_completed),
      orphanedJobs: jobs.filter(job => job.is_orphaned),
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

export default ProductionDataContext.Provider;
