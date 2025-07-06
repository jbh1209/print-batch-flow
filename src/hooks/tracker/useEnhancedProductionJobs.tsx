import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatWONumber } from "@/utils/woNumberFormatter";
import { processJobsArray, RawJobData } from "./useAccessibleJobs/jobDataProcessor";

interface UseEnhancedProductionJobsOptions {
  fetchAllJobs?: boolean; // New option to fetch all jobs instead of user-specific
}

export const useEnhancedProductionJobs = (options: UseEnhancedProductionJobsOptions = {}) => {
  const { user, isLoading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { fetchAllJobs = false } = options;

  const fetchJobs = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      

      // Build the query - conditionally add user filter
      let query = supabase
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

      // Only filter by user if fetchAllJobs is false
      if (!fetchAllJobs && user?.id) {
        query = query.eq('user_id', user.id);
      }

      const { data: jobsData, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(`Failed to fetch jobs: ${fetchError.message}`);
      }

      

      if (!Array.isArray(jobsData)) {
        console.error("Expected array but got:", jobsData);
        setJobs([]);
        setIsLoading(false);
        return;
      }

      // Fetch job stage instances for all jobs
      const jobIds = jobsData.map(job => job.id);
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
              is_multi_part
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
      const enhancedJobsData = jobsData.map(job => {
        const formattedWoNo = formatWONumber(job.wo_no);
        
        // Get stages for this job
        const jobStages = stagesData.filter(stage => stage.job_id === job.id);
        const hasWorkflow = jobStages.length > 0;
        
        // Find current active stage
        const activeStage = jobStages.find(s => s.status === 'active');
        const pendingStages = jobStages.filter(s => s.status === 'pending');
        const completedStages = jobStages.filter(s => s.status === 'completed');
        
        // CRITICAL FIX: Properly determine current stage
        let currentStage = job.status || 'Unknown';
        let currentStageId = null;
        
        if (activeStage) {
          // Use the active stage name
          currentStage = activeStage.production_stages?.name || 'Active Stage';
          currentStageId = activeStage.production_stage_id;
        } else if (pendingStages.length > 0) {
          // If no active stage, the first pending stage is current
          const firstPending = pendingStages.sort((a, b) => a.stage_order - b.stage_order)[0];
          currentStage = firstPending.production_stages?.name || 'Pending Stage';
          currentStageId = firstPending.production_stage_id;
        } else if (hasWorkflow && completedStages.length === jobStages.length && jobStages.length > 0) {
          // All stages completed
          currentStage = 'Completed';
        } else if (!hasWorkflow) {
          // No workflow - use job status or fallback
          currentStage = job.status || 'DTP';
        }
        
        // Calculate workflow progress
        const totalStages = jobStages.length;
        const workflowProgress = totalStages > 0 ? Math.round((completedStages.length / totalStages) * 100) : 0;
        
        // Create properly structured stages array
        const processedStages = jobStages.map(stage => ({
          ...stage,
          production_stage_id: stage.production_stage_id,
          stage_id: stage.production_stage_id, // Alias for compatibility
          stage_name: stage.production_stages?.name || 'Unknown Stage',
          stage_color: stage.production_stages?.color || '#6B7280',
          status: stage.status
        }));

        // Convert to RawJobData format for the centralized processor
        const rawJobData: RawJobData = {
          ...job,
          id: job.id,
          job_id: job.id,
          wo_no: formattedWoNo,
          current_stage: currentStage,
          current_stage_id: currentStageId,
          current_stage_name: currentStage,
          workflow_progress: workflowProgress,
          total_stages: totalStages,
          completed_stages: completedStages.length,
          has_custom_workflow: job.has_custom_workflow,
          manual_due_date: job.manual_due_date,
          due_date: job.due_date,
          stages: processedStages,
          job_stage_instances: jobStages
        };

        return rawJobData;
      });

      // Use centralized processor to handle custom workflow dates consistently
      const processedJobs = processJobsArray(enhancedJobsData);

      // Convert back to enhanced format with additional fields
      const finalJobs = processedJobs.map((processedJob, index) => {
        const originalData = enhancedJobsData[index];
        
        return {
          ...processedJob,
          // Preserve enhanced fields
          has_workflow: originalData.stages?.length > 0,
          stages: originalData.stages,
          job_stage_instances: originalData.job_stage_instances,
          category_id: processedJob.category_id || null,
          // Add computed fields for easier filtering
          is_active: originalData.stages?.some((s: any) => s.status === 'active') || false,
          is_pending: !originalData.stages?.some((s: any) => s.status === 'active') && originalData.stages?.some((s: any) => s.status === 'pending') || false,
          is_completed: originalData.stages?.length > 0 && originalData.stages?.every((s: any) => s.status === 'completed') || false,
          stage_status: originalData.stages?.some((s: any) => s.status === 'active') ? 'active' : (originalData.stages?.some((s: any) => s.status === 'pending') ? 'pending' : 'unknown')
        };
      });

      
      setJobs(finalJobs);
    } catch (err) {
      console.error('❌ Error fetching enhanced production jobs:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load jobs";
      setError(errorMessage);
      toast.error("Failed to load production jobs");
    } finally {
      setIsLoading(false);
    }
  }, [fetchAllJobs, user?.id]);

  const startStage = useCallback(async (jobId: string, stageId: string) => {
    try {
      
      
      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageId)
        .eq('status', 'pending');

      if (error) throw error;

      toast.success("Stage started successfully");
      await fetchJobs();
      return true;
    } catch (err) {
      console.error('Error starting stage:', err);
      toast.error("Failed to start stage");
      return false;
    }
  }, [user?.id, fetchJobs]);

  const completeStage = useCallback(async (jobId: string, stageId: string) => {
    try {
      
      
      const { error } = await supabase.rpc('advance_job_stage', {
        p_job_id: jobId,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: stageId
      });

      if (error) throw error;

      toast.success("Stage completed successfully");
      await fetchJobs();
      return true;
    } catch (err) {
      console.error('Error completing stage:', err);
      toast.error("Failed to complete stage");
      return false;
    }
  }, [fetchJobs]);

  const recordQRScan = useCallback(async (jobId: string, stageId: string, qrData?: any) => {
    try {
      
      
      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          qr_scan_data: qrData || { scanned_at: new Date().toISOString() },
          updated_at: new Date().toISOString()
        })
        .eq('id', stageId);

      if (error) throw error;

      toast.success("QR scan recorded successfully");
      await fetchJobs();
      return true;
    } catch (err) {
      console.error('Error recording QR scan:', err);
      toast.error("Failed to record QR scan");
      return false;
    }
  }, [fetchJobs]);

  // Initial data load
  useEffect(() => {
    if (!authLoading) {
      fetchJobs();
    }
  }, [authLoading, fetchJobs]);

  // Real-time subscription for production jobs
  useEffect(() => {

    const channel = supabase
      .channel(`enhanced_production_jobs_global`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_jobs',
        },
        () => {
          fetchJobs(); // Refetch to get updated data with relations
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_stage_instances',
        },
        () => {
          fetchJobs(); // Refetch to get updated workflow data
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchJobs]);

  const refreshJobs = useCallback(() => {
    fetchJobs();
  }, [fetchJobs]);

  return {
    jobs,
    isLoading: isLoading || authLoading,
    error,
    refreshJobs,
    startStage,
    completeStage,
    recordQRScan
  };
};
