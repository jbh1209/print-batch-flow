
import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const useUnifiedProductionData = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [consolidatedStages, setConsolidatedStages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Helper: Consolidate stages into master/subsidiaries groups
  const consolidateStages = (allStages: any[]) => {
    const result: any[] = [];
    const masterQueueMap: { [id: string]: any } = {};

    allStages?.forEach(stage => {
      if (!stage.is_active) return; // Only include active stages

      if (stage.master_queue_id && stage.master_queue_id !== stage.id) {
        // Subsidiary stage
        if (!masterQueueMap[stage.master_queue_id]) {
          // Find the master stage
          const master = allStages.find(s => s.id === stage.master_queue_id);
          masterQueueMap[stage.master_queue_id] = {
            id: master?.id || stage.master_queue_id,
            name: master?.name || "Master Queue",
            color: master?.color || "#9CA3AF",
            is_active: true,
            order_index: master?.order_index || 0,
            subsidiary_stages: [],
          };
          result.push(masterQueueMap[stage.master_queue_id]);
        }
        masterQueueMap[stage.master_queue_id].subsidiary_stages.push({
          id: stage.id,
          name: stage.name,
          color: stage.color,
        });
      } else {
        // Standalone or master
        result.push({
          id: stage.id,
          name: stage.name,
          color: stage.color,
          is_active: stage.is_active,
          order_index: stage.order_index || 0,
          subsidiary_stages: [],
        });
      }
    });

    // Remove duplicates and sort by order_index
    return result
      .filter((stage, idx, arr) => arr.findIndex(s => s.id === stage.id) === idx)
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  };

  const fetchData = useCallback(async (force = false) => {
    if (!user?.id) {
      setJobs([]);
      setConsolidatedStages([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      if (force) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      // Fetch jobs with categories
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

      // Fetch job stage instances for all jobs
      const jobIds = jobsData?.map(job => job.id) || [];
      let jobStagesData: any[] = [];
      
      if (jobIds.length > 0) {
        const { data: stagesDataRaw, error: stagesErr } = await supabase
          .from('job_stage_instances')
          .select(`
            *,
            production_stages (
              id, name, description, color, is_multi_part, master_queue_id
            )
          `)
          .in('job_id', jobIds)
          .eq('job_table_name', 'production_jobs')
          .order('stage_order', { ascending: true });

        if (stagesErr) throw stagesErr;
        jobStagesData = stagesDataRaw || [];
      }

      // Consolidate production stages
      const consolidated = consolidateStages(allStages || []);

      // Process jobs with proper data transformation
      const processedJobs = (jobsData || []).map(job => {
        const jobStages = jobStagesData.filter(stage => stage.job_id === job.id);
        const hasWorkflow = jobStages.length > 0;
        const activeStage = jobStages.find(s => s.status === 'active');
        const pendingStages = jobStages.filter(s => s.status === 'pending');
        const completedStages = jobStages.filter(s => s.status === 'completed');
        
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
          is_orphaned: false,
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

      setJobs(processedJobs);
      setConsolidatedStages(consolidated);
      setLastUpdated(new Date());
      setIsLoading(false);
      setIsRefreshing(false);

    } catch (err) {
      console.error('Error fetching unified production data:', err);
      setError(err instanceof Error ? err.message : "Failed to load production data");
      setIsLoading(false);
      setIsRefreshing(false);
      toast.error("Failed to load production data");
    }
  }, [user?.id]);

  // Initial fetch and refresh function
  const refreshJobs = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  // Initial data load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter and stats functions
  const getFilteredJobs = ({
    statusFilter,
    stageFilter,
    categoryFilter,
    searchQuery,
  }: {
    statusFilter?: string | null;
    stageFilter?: string | null;
    categoryFilter?: string | null;
    searchQuery?: string;
  }) => {
    let filtered = jobs.filter(job => job.status !== 'Completed' && !job.is_completed);
    
    if (statusFilter) {
      filtered = filtered.filter(j => (statusFilter === 'completed' ? j.is_completed : j.status === statusFilter));
    }
    if (stageFilter) {
      filtered = filtered.filter(j => j.display_stage_name === stageFilter || j.current_stage_name === stageFilter);
    }
    if (categoryFilter) {
      filtered = filtered.filter(j => j.category_name === categoryFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(j =>
        (j.wo_no?.toLowerCase().includes(q) ||
          j.customer?.toLowerCase().includes(q) ||
          j.reference?.toLowerCase().includes(q) ||
          j.category_name?.toLowerCase().includes(q))
      );
    }
    return filtered;
  };

  const getJobStats = (filteredJobs: any[]) => ({
    total: filteredJobs.length,
    pending: filteredJobs.filter(j => j.is_pending).length,
    active: filteredJobs.filter(j => j.is_active).length,
    completed: filteredJobs.filter(j => j.is_completed).length,
    orphaned: filteredJobs.filter(j => j.is_orphaned).length,
  });

  const getTimeSinceLastUpdate = () => {
    if (!lastUpdated) return null;
    const now = new Date();
    const ms = now.getTime() - lastUpdated.getTime();
    const mins = Math.floor(ms / (1000 * 60));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return {
    jobs,
    activeJobs: jobs.filter(job => job.status !== 'Completed' && !job.is_completed),
    orphanedJobs: jobs.filter(job => job.is_orphaned),
    consolidatedStages,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    getFilteredJobs,
    getJobStats,
    refreshJobs,
    getTimeSinceLastUpdate,
  };
};
