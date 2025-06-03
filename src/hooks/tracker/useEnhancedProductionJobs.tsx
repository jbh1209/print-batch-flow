import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatWONumber } from "@/utils/woNumberFormatter";

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
      console.log("🔍 Fetching enhanced production jobs...", { fetchAllJobs, userId: user?.id });

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

      console.log("📊 Raw jobs data:", jobsData?.length || 0, "jobs", { fetchAllJobs });

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
          console.log("📊 Job stage instances:", stagesData.length);
        }
      }

      // Process jobs with enhanced stage information
      const processedJobs = jobsData.map(job => {
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
          console.log(`🎯 Job ${job.wo_no}: Active stage = ${currentStage}`);
        } else if (pendingStages.length > 0) {
          // If no active stage, the first pending stage is current
          const firstPending = pendingStages.sort((a, b) => a.stage_order - b.stage_order)[0];
          currentStage = firstPending.production_stages?.name || 'Pending Stage';
          currentStageId = firstPending.production_stage_id;
          console.log(`🎯 Job ${job.wo_no}: First pending stage = ${currentStage}`);
        } else if (hasWorkflow && completedStages.length === jobStages.length && jobStages.length > 0) {
          // All stages completed
          currentStage = 'Completed';
          console.log(`🎯 Job ${job.wo_no}: All stages completed`);
        } else if (!hasWorkflow) {
          // No workflow - use job status or fallback
          currentStage = job.status || 'DTP';
          console.log(`🎯 Job ${job.wo_no}: No workflow, using status = ${currentStage}`);
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
        
        const processedJob = {
          ...job,
          wo_no: formattedWoNo,
          has_workflow: hasWorkflow,
          current_stage: currentStage, // This is now properly set!
          current_stage_id: currentStageId,
          workflow_progress: workflowProgress,
          job_stage_instances: jobStages,
          stages: processedStages,
          category_id: job.category_id || null,
          // Ensure we have consistent status handling
          status: job.status || currentStage,
          // Add computed fields for easier filtering
          is_active: activeStage ? true : false,
          is_pending: !activeStage && pendingStages.length > 0,
          is_completed: jobStages.length > 0 && completedStages.length === totalStages,
          stage_status: activeStage ? 'active' : (pendingStages.length > 0 ? 'pending' : 'unknown')
        };

        console.log("📋 Enhanced job processing:", {
          woNo: processedJob.wo_no,
          originalStatus: job.status,
          currentStage: processedJob.current_stage, // This should now be the stage name
          currentStageId: processedJob.current_stage_id?.substring(0, 8),
          hasWorkflow: processedJob.has_workflow,
          stagesCount: processedJob.stages.length,
          workflowProgress: processedJob.workflow_progress,
          isActive: processedJob.is_active,
          isPending: processedJob.is_pending
        });

        return processedJob;
      });

      console.log("✅ Enhanced production jobs processed:", processedJobs.length, "jobs");
      setJobs(processedJobs);
    } catch (err) {
      console.error('❌ Error fetching enhanced production jobs:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load jobs";
      setError(errorMessage);
      toast.error("Failed to load production jobs");
    } finally {
      setIsLoading(false);
    }
  }, [fetchAllJobs, user?.id]);

  // Stage management functions
  const startStage = useCallback(async (jobId: string, stageId: string) => {
    try {
      console.log('Starting stage:', { jobId, stageId });
      
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
      console.log('Completing stage:', { jobId, stageId });
      
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
      console.log('Recording QR scan:', { jobId, stageId, qrData });
      
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
    console.log("Setting up real-time subscription for enhanced production jobs");

    const channel = supabase
      .channel(`enhanced_production_jobs_global`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_jobs',
        },
        (payload) => {
          console.log('Production jobs changed:', payload.eventType);
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
        (payload) => {
          console.log('Job stage instances changed:', payload.eventType);
          fetchJobs(); // Refetch to get updated workflow data
        }
      )
      .subscribe();

    return () => {
      console.log("Cleaning up enhanced production jobs real-time subscription");
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
