
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";

// --- UPDATED TYPE: Enriched production job with 'categories'
export interface ProductionJob {
  id: string;
  wo_no: string;
  status: string;
  date?: string | null;
  so_no?: string | null;
  qt_no?: string | null;
  rep?: string | null;
  user_name?: string | null;
  category?: string | null;
  customer?: string | null;
  reference?: string | null;
  qty?: number | null;
  due_date?: string | null;
  location?: string | null;
  highlighted?: boolean;
  qr_code_data?: string | null;
  qr_code_url?: string | null;
  created_at?: string;
  updated_at?: string;
  // Enriched join: categories (for SLA and color)
  categories?: {
    id: string;
    name: string;
    description?: string;
    color?: string;
    sla_target_days?: number | null;
  } | null;
  category_name?: string | null; // Helper for consistency
}

export const useProductionJobs = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- UPDATED QUERY: Fetch ALL jobs with ANY workflow stages, filter out only 'Completed'
  const fetchJobs = useCallback(async () => {
    if (!user?.id) {
      setJobs([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      setError(null);
      console.log("Fetching ALL production jobs with workflows (excluding Completed)");

      // First get all jobs that have ANY job_stage_instances (regardless of status)
      const { data: jobsWithWorkflow, error: workflowJobsError } = await supabase
        .from('job_stage_instances')
        .select('job_id')
        .eq('job_table_name', 'production_jobs');

      if (workflowJobsError) {
        throw new Error(`Failed to fetch workflow jobs: ${workflowJobsError.message}`);
      }

      const workflowJobIds = [...new Set(jobsWithWorkflow?.map(j => j.job_id) || [])];

      if (workflowJobIds.length === 0) {
        console.log("No jobs with workflows found");
        setJobs([]);
        setIsLoading(false);
        return;
      }

      // Now fetch ALL job data for jobs with workflows, excluding only 'Completed' status
      const { data, error: fetchError } = await supabase
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
        .in('id', workflowJobIds)
        .neq('status', 'Completed') // Only exclude 'Completed' jobs
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw new Error(`Failed to fetch jobs: ${fetchError.message}`);
      }

      console.log("Production jobs with workflows (excluding Completed) fetched:", data?.length || 0, "jobs");
      // Enrich helper
      const jobsWithHelpers = (data ?? []).map((job: any) => ({
        ...job,
        category_name: job.categories?.name ?? job.category ?? null,
      }));
      setJobs(jobsWithHelpers);
    } catch (err) {
      console.error('Error fetching production jobs:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load jobs";
      setError(errorMessage);
      toast.error("Failed to load production jobs");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Update job status method
  const updateJobStatus = useCallback(async (jobId: string, newStatus: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('production_jobs')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', jobId);

      if (error) {
        console.error("Error updating job status:", error);
        return false;
      }

      // Optimistically update the local state
      setJobs(prevJobs => 
        prevJobs.map(job => 
          job.id === jobId ? { ...job, status: newStatus } : job
        )
      );

      return true;
    } catch (err) {
      console.error('Error updating job status:', err);
      return false;
    }
  }, []);

  // Initial data load
  useEffect(() => {
    if (!authLoading) {
      fetchJobs();
    }
  }, [authLoading, fetchJobs]);

  // Optimized real-time subscription with proper error handling
  useEffect(() => {
    if (!user?.id) return;

    console.log("Setting up real-time subscription for production jobs");

    const channel = supabase
      .channel(`production_jobs_all`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_jobs',
        },
        (payload) => {
          console.log('Production jobs changed:', payload.eventType);
          
          if (payload.eventType === 'UPDATE' && payload.new) {
            // Optimistic update for status changes
            setJobs(prevJobs => 
              prevJobs.map(job => 
                job.id === payload.new.id ? { 
                  ...job, 
                  ...payload.new
                } : job
              )
            );
          } else {
            // Refetch for INSERT/DELETE to avoid stale data
            fetchJobs();
          }
        }
      )
      .subscribe((status) => {
        console.log("Real-time subscription status:", status);
        if (status !== REALTIME_SUBSCRIBE_STATES.SUBSCRIBED && status !== REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR) {
          console.error("Real-time subscription failed with status:", status);
          setError("Real-time updates unavailable");
        }
      });

    return () => {
      console.log("Cleaning up real-time subscription");
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchJobs]);

  // Helper functions - now derive status from workflow system instead of hardcoded values
  const getJobsByStatus = useCallback((status: string) => {
    return jobs.filter(job => (job.status || 'Unknown') === status);
  }, [jobs]);

  const getJobStats = useCallback(() => {
    // Get unique statuses from actual jobs instead of hardcoded list
    const uniqueStatuses = Array.from(new Set(jobs.map(job => job.status || 'Unknown')));
    const statusCounts: Record<string, number> = {};
    
    // Initialize counts
    uniqueStatuses.forEach(status => {
      statusCounts[status] = 0;
    });
    
    // Count actual jobs
    jobs.forEach(job => {
      const status = job.status || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    return {
      total: jobs.length,
      statusCounts
    };
  }, [jobs]);

  return {
    jobs,
    isLoading: isLoading || authLoading,
    error,
    fetchJobs,
    updateJobStatus,
    getJobsByStatus,
    getJobStats
  };
};
