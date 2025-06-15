
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface KanbanJob {
  id: string;
  wo_no: string;
  customer: string;
  status: string;
  due_date?: string;
  reference?: string;
  category_id?: string;
  category_name?: string;
  stages?: any[];
  // ... extend as needed based on your columns
}

interface KanbanDataContextType {
  jobs: KanbanJob[];
  stages: any[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

const KanbanDataContext = createContext<KanbanDataContextType | undefined>(undefined);

export const useKanbanDataContext = () => {
  const ctx = useContext(KanbanDataContext);
  if (!ctx) throw new Error("useKanbanDataContext must be used within KanbanDataProvider");
  return ctx;
};

// --- Data Fetching/Caching/Realtime ---
let globalKanbanCache = { jobs: [] as KanbanJob[], stages: [], lastUpdated: 0 };

export const KanbanDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<KanbanJob[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const subscriptionRef = useRef<any>(null);

  // 5 min cache
  const CACHE_TTL = 5 * 60 * 1000;

  const fetchKanbanData = useCallback(async (force = false) => {
    if (
      !force &&
      globalKanbanCache.jobs.length &&
      globalKanbanCache.stages.length &&
      Date.now() - globalKanbanCache.lastUpdated < CACHE_TTL
    ) {
      setJobs(globalKanbanCache.jobs);
      setStages(globalKanbanCache.stages);
      setLastUpdated(new Date(globalKanbanCache.lastUpdated));
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // Fetch jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('production_jobs')
        .select("*")
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;

      // Fetch stages
      const { data: stagesData, error: stagesErr } = await supabase
        .from('production_stages')
        .select("*")
        .order('order_index', { ascending: true });

      if (stagesErr) throw stagesErr;

      globalKanbanCache = {
        jobs: jobsData,
        stages: stagesData,
        lastUpdated: Date.now(),
      };
      setJobs(jobsData);
      setStages(stagesData);
      setLastUpdated(new Date());
      setIsLoading(false);
      setIsRefreshing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Kanban data");
      setIsLoading(false);
      setIsRefreshing(false);
      toast.error("Failed to load Kanban data");
    }
  }, []);

  const refresh = useCallback(() => fetchKanbanData(true), [fetchKanbanData]);

  // Real-time only ONCE
  useEffect(() => {
    fetchKanbanData(false);
    if (!subscriptionRef.current) {
      const channel = supabase
        .channel("kanban_realtime")
        .on('postgres_changes', { event: '*', schema: 'public', table: 'production_jobs' }, () => fetchKanbanData(true))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'production_stages' }, () => fetchKanbanData(true))
        .subscribe();
      subscriptionRef.current = channel;
    }
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
    // eslint-disable-next-line
  }, []);

  return (
    <KanbanDataContext.Provider value={{ jobs, stages, isLoading, isRefreshing, error, lastUpdated, refresh }}>
      {children}
    </KanbanDataContext.Provider>
  );
};
