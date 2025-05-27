
import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProductionJobsData } from "./tracker/useProductionJobsData";
import { useProductionJobOperations } from "./tracker/useProductionJobOperations";
import { useProductionJobStats } from "./tracker/useProductionJobStats";

export const useProductionJobs = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { jobs, isLoading, error, fetchJobs, setJobs } = useProductionJobsData();
  const { updateJobStatus: updateStatus } = useProductionJobOperations();
  const { getJobsByStatus, getJobStats } = useProductionJobStats(jobs);
  
  const realtimeChannelRef = useRef<any>(null);
  const lastUpdateRef = useRef<number>(0);
  const setupRef = useRef<boolean>(false);
  const DEBOUNCE_DELAY = 1000; // 1 second debounce

  // Optimized real-time subscription setup
  const setupRealtimeSubscription = useCallback(() => {
    if (!user?.id || realtimeChannelRef.current || setupRef.current || authLoading) {
      return null;
    }

    setupRef.current = true;
    console.log("Setting up optimized real-time subscription for user:", user.id);

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
          
          const now = Date.now();
          const timeSinceLastUpdate = now - lastUpdateRef.current;
          
          // Debounce rapid updates
          if (timeSinceLastUpdate < DEBOUNCE_DELAY) {
            console.log('Debouncing real-time update');
            return;
          }
          
          lastUpdateRef.current = now;
          
          // Handle different event types without full refetch when possible
          if (payload.eventType === 'UPDATE' && payload.new) {
            // Optimistic update for status changes
            setJobs(prevJobs => 
              prevJobs.map(job => 
                job.id === payload.new.id ? { ...job, ...payload.new } : job
              )
            );
          } else {
            // Only fetch for INSERT/DELETE or when we can't do optimistic update
            setTimeout(() => {
              fetchJobs();
            }, 100);
          }
        }
      )
      .subscribe((status) => {
        console.log("Real-time subscription status:", status);
      });

    realtimeChannelRef.current = channel;
    return channel;
  }, [user?.id, fetchJobs, setJobs, authLoading]);

  // Set up real-time subscription only when auth is ready
  useEffect(() => {
    if (authLoading || !user?.id) {
      return;
    }
    
    const channel = setupRealtimeSubscription();
    
    return () => {
      if (realtimeChannelRef.current) {
        console.log("Cleaning up real-time subscription");
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
        setupRef.current = false;
      }
    };
  }, [user?.id, authLoading]); // Only depend on user.id and authLoading

  // Optimized job status update with optimistic updates
  const updateJobStatus = useCallback(async (jobId: string, newStatus: string) => {
    console.log("Updating job status:", jobId, "to", newStatus);
    
    // Optimistic update
    setJobs(prevJobs => 
      prevJobs.map(job => 
        job.id === jobId ? { ...job, status: newStatus } : job
      )
    );
    
    try {
      const success = await updateStatus(jobId, newStatus);
      
      if (!success) {
        // Revert optimistic update on failure
        console.error("Failed to update job status, reverting");
        fetchJobs(); // Refetch to get correct state
      }
      
      return success;
    } catch (error) {
      console.error("Error updating job status:", error);
      // Revert optimistic update on error
      fetchJobs();
      return false;
    }
  }, [updateStatus, setJobs, fetchJobs]);

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
