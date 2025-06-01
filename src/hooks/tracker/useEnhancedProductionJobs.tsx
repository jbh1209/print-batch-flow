
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
    if (!user?.id) {
      setJobs([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      setError(null);
      console.log("Fetching enhanced production jobs for user:", user.id);

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
          ),
          job_stage_instances (
            id,
            production_stage_id,
            stage_order,
            status,
            started_at,
            completed_at,
            part_name,
            production_stages (
              id,
              name,
              description,
              color,
              is_multi_part
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw new Error(`Failed to fetch jobs: ${fetchError.message}`);
      }

      // Process jobs and ensure WO numbers have proper formatting
      const processedJobs = (jobsData || []).map(job => {
        // Ensure WO number has proper D prefix formatting
        const formattedWoNo = formatWONumber(job.wo_no);
        
        // Calculate workflow status
        const stages = job.job_stage_instances || [];
        const hasWorkflow = stages.length > 0;
        const currentStage = stages.find(s => s.status === 'active');
        const completedStages = stages.filter(s => s.status === 'completed').length;
        const totalStages = stages.length;
        
        return {
          ...job,
          wo_no: formattedWoNo, // Apply formatting
          has_workflow: hasWorkflow,
          current_stage: currentStage?.production_stages?.name || null,
          current_stage_id: currentStage?.production_stage_id || null,
          workflow_progress: totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0,
          stages: stages.map(stage => ({
            ...stage,
            stage_name: stage.production_stages?.name || 'Unknown Stage',
            stage_color: stage.production_stages?.color || '#6B7280'
          }))
        };
      });

      console.log("Enhanced production jobs fetched:", processedJobs.length, "jobs");
      setJobs(processedJobs);
    } catch (err) {
      console.error('Error fetching enhanced production jobs:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load jobs";
      setError(errorMessage);
      toast.error("Failed to load production jobs");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Initial data load
  useEffect(() => {
    if (!authLoading) {
      fetchJobs();
    }
  }, [authLoading, fetchJobs]);

  // Real-time subscription for production jobs
  useEffect(() => {
    if (!user?.id) return;

    console.log("Setting up real-time subscription for enhanced production jobs");

    const channel = supabase
      .channel(`enhanced_production_jobs_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_jobs',
          filter: `user_id=eq.${user.id}`,
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
  }, [user?.id, fetchJobs]);

  const refreshJobs = useCallback(() => {
    fetchJobs();
  }, [fetchJobs]);

  return {
    jobs,
    isLoading: isLoading || authLoading,
    error,
    refreshJobs
  };
};
