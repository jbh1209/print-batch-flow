
import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserStagePermissions } from "./useUserStagePermissions";
import { toast } from "sonner";
import { formatWONumber } from "@/utils/woNumberFormatter";

interface UnifiedProductionJob {
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

export const useUnifiedProductionData = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { consolidatedStages, isLoading: permissionsLoading, isAdmin } = useUserStagePermissions(user?.id);
  
  const [jobs, setJobs] = useState<UnifiedProductionJob[]>([]);
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

      console.log("🔍 Fetching unified production data...");

      // Fetch ALL production jobs (no user filtering for production view)
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

      // Process jobs with enhanced stage information and orphaned detection
      const processedJobs: UnifiedProductionJob[] = (jobsData || []).map(job => {
        const formattedWoNo = formatWONumber(job.wo_no);
        
        // Get stages for this job
        const jobStages = stagesData.filter(stage => stage.job_id === job.id);
        const hasWorkflow = jobStages.length > 0;
        const hasCategory = !!job.category_id;
        const isOrphaned = hasCategory && !hasWorkflow;
        
        // Find current active stage
        const activeStage = jobStages.find(s => s.status === 'active');
        const pendingStages = jobStages.filter(s => s.status === 'pending');
        const completedStages = jobStages.filter(s => s.status === 'completed');
        
        // Determine current stage properly
        let currentStage = job.status || 'Unknown';
        let currentStageId = null;
        let displayStageName = null;
        
        if (isOrphaned) {
          currentStage = 'Needs Repair';
          displayStageName = 'Category assigned but no workflow';
        } else if (activeStage) {
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
        } else if (!hasWorkflow && !hasCategory) {
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
          is_orphaned: isOrphaned,
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

      console.log("✅ Unified production data processed:", processedJobs.length, "jobs");
      const orphanedCount = processedJobs.filter(job => job.is_orphaned).length;
      if (orphanedCount > 0) {
        console.warn(`⚠️ Found ${orphanedCount} orphaned jobs (category but no workflow)`);
      }
      
      setJobs(processedJobs);
      setLastUpdated(new Date());
      
    } catch (err) {
      console.error('❌ Error fetching unified production data:', err);
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

  // Get orphaned jobs count
  const orphanedJobs = useMemo(() => {
    return jobs.filter(job => job.is_orphaned);
  }, [jobs]);

  // Apply filtering based on user permissions and stage access
  const getFilteredJobs = useCallback((filters?: {
    statusFilter?: string | null;
    stageFilter?: string | null;
    categoryFilter?: string | null;
    searchQuery?: string;
  }) => {
    const { statusFilter, stageFilter, categoryFilter, searchQuery } = filters || {};
    
    let filteredJobs = activeJobs;

    // For non-admin users, filter by accessible stages
    if (!isAdmin && consolidatedStages.length > 0) {
      const accessibleStageNames = consolidatedStages.map(stage => stage.stage_name.toLowerCase());
      
      filteredJobs = filteredJobs.filter(job => {
        // Always show orphaned jobs so they can be repaired
        if (job.is_orphaned) return true;
        
        const effectiveStageDisplay = job.display_stage_name || job.current_stage_name;
        return effectiveStageDisplay && accessibleStageNames.includes(effectiveStageDisplay.toLowerCase());
      });
    }

    // Apply filters
    if (statusFilter) {
      filteredJobs = filteredJobs.filter(job => {
        if (statusFilter === 'completed') {
          return job.status === 'Completed' || job.is_completed;
        }
        if (statusFilter === 'orphaned') {
          return job.is_orphaned;
        }
        return job.status?.toLowerCase() === statusFilter.toLowerCase();
      });
    }

    if (stageFilter) {
      filteredJobs = filteredJobs.filter(job => {
        const stageNameForFiltering = job.display_stage_name || job.current_stage_name;
        return stageNameForFiltering?.toLowerCase() === stageFilter.toLowerCase();
      });
    }

    if (categoryFilter) {
      filteredJobs = filteredJobs.filter(job => 
        job.category_name?.toLowerCase() === categoryFilter.toLowerCase()
      );
    }

    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredJobs = filteredJobs.filter(job => {
        const searchFields = [
          job.wo_no,
          job.customer,
          job.reference,
          job.category_name,
          job.status,
          job.current_stage_name,
          job.display_stage_name
        ].filter(Boolean);

        return searchFields.some(field => 
          field?.toLowerCase().includes(query)
        );
      });
    }

    return filteredJobs;
  }, [activeJobs, consolidatedStages, isAdmin]);

  // Calculate job statistics
  const getJobStats = useCallback((filteredJobs: UnifiedProductionJob[]) => {
    return {
      total: filteredJobs.length,
      pending: filteredJobs.filter(job => job.is_pending).length,
      active: filteredJobs.filter(job => job.is_active).length,
      completed: filteredJobs.filter(job => job.is_completed).length,
      orphaned: filteredJobs.filter(job => job.is_orphaned).length,
      urgent: filteredJobs.filter(job => {
        if (!job.due_date) return false;
        const dueDate = new Date(job.due_date);
        const today = new Date();
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 2; // Due within 2 days
      }).length
    };
  }, []);

  // Manual refresh function
  const refreshJobs = useCallback(() => {
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
    if (!authLoading && !permissionsLoading) {
      fetchJobs();
    }
  }, [authLoading, permissionsLoading, fetchJobs]);

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    console.log("Setting up real-time subscription for unified production data");

    const channel = supabase
      .channel(`unified_production_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_jobs',
        },
        (payload) => {
          console.log('Production jobs changed:', payload.eventType);
          fetchJobs(false);
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
          fetchJobs(false);
        }
      )
      .subscribe();

    return () => {
      console.log("Cleaning up unified production real-time subscription");
      supabase.removeChannel(channel);
    };
  }, [fetchJobs, user?.id]);

  return {
    // Data
    jobs,
    activeJobs,
    orphanedJobs,
    consolidatedStages,
    
    // State
    isLoading: isLoading || authLoading || permissionsLoading,
    isRefreshing,
    error,
    lastUpdated,
    
    // Functions
    getFilteredJobs,
    getJobStats,
    refreshJobs,
    getTimeSinceLastUpdate
  };
};
