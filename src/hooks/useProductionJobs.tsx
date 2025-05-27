
import { useEffect, useCallback } from "react";
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

  // Memoize the real-time subscription setup
  const setupRealtimeSubscription = useCallback(() => {
    if (!user?.id) {
      console.log("No user ID, skipping real-time subscription");
      return null;
    }

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
          console.log('Production jobs changed:', payload);
          // Use a timeout to prevent conflicts with ongoing operations
          setTimeout(() => {
            fetchJobs();
          }, 100);
        }
      )
      .subscribe((status) => {
        console.log("Real-time subscription status:", status);
      });

    return channel;
  }, [user?.id, fetchJobs]);

  // Set up real-time subscription
  useEffect(() => {
    const channel = setupRealtimeSubscription();
    
    return () => {
      if (channel) {
        console.log("Cleaning up real-time subscription");
        supabase.removeChannel(channel);
      }
    };
  }, [setupRealtimeSubscription]);

  const updateJobStatus = useCallback(async (jobId: string, newStatus: string) => {
    console.log("Updating job status:", jobId, "to", newStatus);
    
    const success = await updateStatus(jobId, newStatus);
    
    if (success) {
      // Update local state immediately for better UX
      setJobs(prevJobs => 
        prevJobs.map(job => 
          job.id === jobId ? { ...job, status: newStatus } : job
        )
      );
    }
    
    return success;
  }, [updateStatus, setJobs]);

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
