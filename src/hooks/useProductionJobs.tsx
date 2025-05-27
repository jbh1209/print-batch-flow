
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ProductionJob {
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
}

export const useProductionJobs = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simple data fetching
  const fetchJobs = useCallback(async () => {
    if (!user?.id) {
      setJobs([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      setError(null);
      console.log("Fetching production jobs for user:", user.id);

      const { data, error: fetchError } = await supabase
        .from('production_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw new Error(`Failed to fetch jobs: ${fetchError.message}`);
      }

      console.log("Production jobs fetched:", data?.length || 0, "jobs");
      setJobs(data || []);
    } catch (err) {
      console.error('Error fetching production jobs:', err);
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

  // Simple real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    console.log("Setting up real-time subscription for user:", user.id);

    const channel = supabase
      .channel(`production_jobs_${user.id}`)
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
          
          if (payload.eventType === 'UPDATE' && payload.new) {
            // Optimistic update for status changes
            setJobs(prevJobs => 
              prevJobs.map(job => 
                job.id === payload.new.id ? { ...job, ...payload.new } : job
              )
            );
          } else {
            // Refetch for INSERT/DELETE
            fetchJobs();
          }
        }
      )
      .subscribe((status) => {
        console.log("Real-time subscription status:", status);
      });

    return () => {
      console.log("Cleaning up real-time subscription");
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchJobs]);

  // Job status update with optimistic updates
  const updateJobStatus = useCallback(async (jobId: string, newStatus: string) => {
    console.log("Updating job status:", jobId, "to", newStatus);
    
    // Optimistic update
    setJobs(prevJobs => 
      prevJobs.map(job => 
        job.id === jobId ? { ...job, status: newStatus } : job
      )
    );
    
    try {
      const { error } = await supabase
        .from('production_jobs')
        .update({ status: newStatus })
        .eq('id', jobId);

      if (error) {
        console.error("Failed to update job status:", error);
        // Revert optimistic update
        fetchJobs();
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Error updating job status:", error);
      // Revert optimistic update
      fetchJobs();
      return false;
    }
  }, [fetchJobs]);

  // Helper functions
  const getJobsByStatus = useCallback((status: string) => {
    return jobs.filter(job => (job.status || 'Pre-Press') === status);
  }, [jobs]);

  const getJobStats = useCallback(() => {
    const statusCounts: Record<string, number> = {};
    
    // Initialize all statuses with 0
    const allStatuses = ["Pre-Press", "Printing", "Finishing", "Packaging", "Shipped", "Completed"];
    allStatuses.forEach(status => {
      statusCounts[status] = 0;
    });
    
    // Count actual jobs
    jobs.forEach(job => {
      const status = job.status || 'Pre-Press';
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status]++;
      }
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
