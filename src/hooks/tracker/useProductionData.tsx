
import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatWONumber } from "@/utils/woNumberFormatter";

interface ProductionJob {
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
  stages: any[];
  job_stage_instances: any[];
  is_active: boolean;
  is_pending: boolean;
  is_completed: boolean;
  stage_status: string;
}

export const useProductionData = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchJobs = useCallback(async (forceRefresh = false) => {
    if (!user?.id && !authLoading) {
      setJobs([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      if (forceRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      console.log("🔍 Fetching production data...");

      // Fetch production jobs with categories
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

      if (jobsError) {
        throw new Error(`Failed to fetch jobs: ${jobsError.message}`);
      }

      // Fetch all job stage instances
      const jobIds = jobsData?.map(job => job.id) || [];
      let stagesData: any[] = [];
      
      if (jobIds.length > 0) {
        const { data: stagesResult, error: stagesError } = await supabase
          .from('job_stage_instances')
          .select(`
            *,
            production_stages (
              id,
              name,
              description,
              color,
              is_multi_part,
              master_queue_id,
              production_stages!master_queue_id (
                name
              )
            )
          `)
          .in('job_id', jobIds)
          .eq('job_table_name', 'production_jobs')
          .order('stage_order', { ascending: true });

        if (stagesError) {
          console.error("❌ Error fetching stages:", stagesError);
        } else {
          stagesData = stagesResult || [];
        }
      }

      // Process jobs with enhanced stage information
      const processedJobs: ProductionJob[] = (jobsData || []).map(job => {
        const formattedWoNo = formatWONumber(job.wo_no);
        
        // Get stages for this job
        const jobStages = stagesData.filter(stage => stage.job_id === job.id);
        const hasWorkflow = jobStages.length > 0;
        
        // Find current active stage
        const activeStage = jobStages.find(s => s.status === 'active');
        const pendingStages = jobStages.filter(s => s.status === 'pending');
        const completedStages = jobStages.filter(s => s.status === 'completed');
        
        // Determine current stage properly
        let currentStage = job.status || 'Unknown';
        let currentStageId = null;
        let displayStageName = null;
        
        if (activeStage) {
          currentStage = activeStage.production_stages?.name || 'Active Stage';
          currentStageId = activeStage.production_stage_id;
          
          // Check for master queue display name
          const masterQueueName = activeStage.production_stages?.production_stages?.name;
          displayStageName = masterQueueName 
            ? `${masterQueueName} - ${currentStage}`
            : currentStage;
        } else if (pendingStages.length > 0) {
          const firstPending = pendingStages.sort((a, b) => a.stage_order - b.stage_order)[0];
          currentStage = firstPending.production_stages?.name || 'Pending Stage';
          currentStageId = firstPending.production_stage_id;
          
          const masterQueueName = firstPending.production_stages?.production_stages?.name;
          displayStageName = masterQueueName 
            ? `${masterQueueName} - ${currentStage}`
            : currentStage;
        } else if (hasWorkflow && completedStages.length === jobStages.length && jobStages.length > 0) {
          currentStage = 'Completed';
          displayStageName = 'Completed';
        } else if (!hasWorkflow) {
          currentStage = job.status || 'DTP';
          displayStageName = currentStage;
        }
        
        // Calculate workflow progress
        const totalStages = jobStages.length;
        const workflowProgress = totalStages > 0 ? Math.round((completedStages.length / totalStages) * 100) : 0;
        
        return {
          id: job.id,
          wo_no: formattedWoNo,
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
          stages: jobStages.map(stage => ({
            ...stage,
            stage_name: stage.production_stages?.name || 'Unknown Stage',
            stage_color: stage.production_stages?.color || '#6B7280',
          })),
          job_stage_instances: jobStages,
          is_active: activeStage ? true : false,
          is_pending: !activeStage && pendingStages.length > 0,
          is_completed: jobStages.length > 0 && completedStages.length === totalStages,
          stage_status: activeStage ? 'active' : (pendingStages.length > 0 ? 'pending' : 'unknown')
        };
      });

      console.log("✅ Production data processed:", processedJobs.length, "jobs");
      setJobs(processedJobs);
      setLastUpdated(new Date());
      
    } catch (err) {
      console.error('❌ Error fetching production data:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load production data";
      setError(errorMessage);
      toast.error("Failed to load production data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id, authLoading]);

  // Filter active jobs (excluding completed)
  const activeJobs = useMemo(() => {
    return jobs.filter(job => job.status !== 'Completed' && !job.is_completed);
  }, [jobs]);

  // Get unique stages from accessible jobs
  const availableStages = useMemo(() => {
    const stageMap = new Map();
    
    jobs.forEach(job => {
      if (job.current_stage_id && job.current_stage_name) {
        const displayName = job.display_stage_name || job.current_stage_name;
        stageMap.set(job.current_stage_id, {
          id: job.current_stage_id,
          name: job.current_stage_name,
          display_name: displayName,
          color: job.current_stage_color || '#6B7280',
          job_count: (stageMap.get(job.current_stage_id)?.job_count || 0) + 1
        });
      }
    });
    
    return Array.from(stageMap.values()).sort((a, b) => a.display_name.localeCompare(b.display_name));
  }, [jobs]);

  // Manual refresh function
  const manualRefresh = useCallback(() => {
    fetchJobs(true);
  }, [fetchJobs]);

  // Get time since last update
  const getTimeSinceLastUpdate = useCallback(() => {
    if (!lastUpdated) return null;
    const now = new Date();
    const diffMs = now.getTime() - lastUpdated.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    
    if (diffMinutes < 1) return `${diffSeconds}s ago`;
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }, [lastUpdated]);

  // Initial data load
  useEffect(() => {
    if (!authLoading) {
      fetchJobs();
    }
  }, [authLoading, fetchJobs]);

  // Real-time subscription
  useEffect(() => {
    console.log("Setting up real-time subscription for production data");

    const channel = supabase
      .channel(`production_data_${user?.id || 'global'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_jobs',
        },
        (payload) => {
          console.log('Production jobs changed:', payload.eventType);
          fetchJobs(false); // Background refresh
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_stage_instances',
        },
        (payload) => {
          console.log('Job stage instances changed:', payload.eventType);
          fetchJobs(false); // Background refresh
        }
      )
      .subscribe();

    return () => {
      console.log("Cleaning up production data real-time subscription");
      supabase.removeChannel(channel);
    };
  }, [fetchJobs, user?.id]);

  return {
    // Data
    jobs,
    activeJobs,
    availableStages,
    
    // State
    isLoading: isLoading || authLoading,
    isRefreshing,
    error,
    lastUpdated,
    
    // Actions
    refreshJobs: manualRefresh,
    fetchJobs,
    getTimeSinceLastUpdate
  };
};
