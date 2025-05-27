
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProductionJobsData } from "./tracker/useProductionJobsData";
import { useProductionJobOperations } from "./tracker/useProductionJobOperations";
import { useProductionJobStats } from "./tracker/useProductionJobStats";

export const useProductionJobs = () => {
  const { user } = useAuth();
  const { jobs, isLoading, error, fetchJobs, setJobs } = useProductionJobsData();
  const { updateJobStatus: updateStatus } = useProductionJobOperations();
  const { getJobsByStatus, getJobStats } = useProductionJobStats(jobs);

  useEffect(() => {
    fetchJobs();

    // Set up real-time subscription
    const channel = supabase
      .channel('production_jobs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_jobs',
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          console.log('Production jobs changed, refetching...');
          fetchJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const updateJobStatus = async (jobId: string, newStatus: string) => {
    const success = await updateStatus(jobId, newStatus);
    
    if (success) {
      // Update local state
      setJobs(prevJobs => 
        prevJobs.map(job => 
          job.id === jobId ? { ...job, status: newStatus } : job
        )
      );
    }
    
    return success;
  };

  return {
    jobs,
    isLoading,
    error,
    fetchJobs,
    updateJobStatus,
    getJobsByStatus,
    getJobStats
  };
};
