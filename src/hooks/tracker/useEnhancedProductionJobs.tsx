
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatWONumber } from "@/utils/woNumberFormatter";

export const useEnhancedProductionJobs = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      console.log("🔍 Fetching enhanced production jobs...");

      // First fetch ALL production jobs (not filtered by user_id since this is for the operator dashboard)
      const { data: jobsData, error: fetchError } = await supabase
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

      if (fetchError) {
        throw new Error(`Failed to fetch jobs: ${fetchError.message}`);
      }

      console.log("📊 Raw jobs data:", jobsData?.length || 0, "jobs");

      // Check if jobsData is an array before processing
      if (!Array.isArray(jobsData)) {
        console.error("Expected array but got:", jobsData);
        setJobs([]);
        setIsLoading(false);
        return;
      }

      // Then fetch job stage instances for all jobs
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

      // Process jobs and combine with stage data
      const processedJobs = jobsData.map(job => {
        // Ensure WO number has proper D prefix formatting
        const formattedWoNo = formatWONumber(job.wo_no);
        
        // Get stages for this job
        const jobStages = stagesData.filter(stage => stage.job_id === job.id);
        const hasWorkflow = jobStages.length > 0;
        const currentStage = jobStages.find(s => s.status === 'active');
        const completedStages = jobStages.filter(s => s.status === 'completed').length;
        const totalStages = jobStages.length;
        
        const processedJob = {
          ...job,
          wo_no: formattedWoNo,
          has_workflow: hasWorkflow,
          current_stage: currentStage?.production_stages?.name || job.status || 'DTP',
          current_stage_id: currentStage?.production_stage_id || null,
          workflow_progress: totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0,
          job_stage_instances: jobStages,
          stages: jobStages.map(stage => ({
            ...stage,
            stage_name: stage.production_stages?.name || 'Unknown Stage',
            stage_color: stage.production_stages?.color || '#6B7280'
          })),
          // Include category_id for filtering
          category_id: job.category_id || null
        };

        console.log("📋 Processed job:", {
          woNo: processedJob.wo_no,
          status: processedJob.status,
          currentStage: processedJob.current_stage,
          hasWorkflow: processedJob.has_workflow,
          stagesCount: processedJob.stages.length
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
  }, []); // Remove user dependency to fetch all jobs

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
