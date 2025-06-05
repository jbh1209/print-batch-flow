
import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface RealtimeSubscriptionOptions {
  onJobUpdate?: (jobId: string, updateType: 'status' | 'stage' | 'progress') => void;
  batchDelay?: number;
}

export const useRealtimeSubscription = (
  fetchJobs: () => Promise<void>,
  options: RealtimeSubscriptionOptions = {}
) => {
  const { user } = useAuth();
  const channelRef = useRef<any>(null);
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Set<string>>(new Set());
  
  const { onJobUpdate, batchDelay = 500 } = options;

  // Batched update handler to prevent UI thrashing
  const handleBatchedUpdate = useCallback(() => {
    if (pendingUpdatesRef.current.size > 0) {
      console.log('📦 Processing batched updates for jobs:', Array.from(pendingUpdatesRef.current));
      
      // Clear pending updates
      pendingUpdatesRef.current.clear();
      
      // Fetch fresh data
      fetchJobs().catch(console.error);
    }
  }, [fetchJobs]);

  // Queue an update with batching
  const queueUpdate = useCallback((jobId: string, updateType: 'status' | 'stage' | 'progress') => {
    pendingUpdatesRef.current.add(jobId);
    
    // Notify callback if provided
    onJobUpdate?.(jobId, updateType);
    
    // Clear existing timeout and set new one
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    
    batchTimeoutRef.current = setTimeout(handleBatchedUpdate, batchDelay);
  }, [handleBatchedUpdate, onJobUpdate, batchDelay]);

  useEffect(() => {
    if (!user?.id) return;

    console.log("🔄 Setting up enhanced real-time subscription for accessible jobs");

    // Cleanup any existing channel
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
      } catch (error) {
        console.warn("⚠️ Error removing existing channel:", error);
      }
    }

    try {
      const channel = supabase
        .channel(`accessible_jobs_enhanced_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'production_jobs',
          },
          (payload) => {
            console.log('📦 Production jobs changed:', {
              event: payload.eventType,
              jobId: payload.new?.id || payload.old?.id
            });
            
            const jobId = payload.new?.id || payload.old?.id;
            if (jobId) {
              queueUpdate(jobId, 'status');
            }
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
            console.log('🎯 Job stage instances changed:', {
              event: payload.eventType,
              jobId: payload.new?.job_id || payload.old?.job_id,
              stageId: payload.new?.production_stage_id || payload.old?.production_stage_id
            });
            
            const jobId = payload.new?.job_id || payload.old?.job_id;
            if (jobId) {
              queueUpdate(jobId, 'stage');
            }
          }
        )
        .subscribe((status) => {
          console.log("🔄 Enhanced real-time subscription status:", status);
        });

      channelRef.current = channel;
    } catch (error) {
      console.warn("⚠️ Failed to set up enhanced real-time subscription:", error);
    }

    return () => {
      console.log("🧹 Cleaning up enhanced real-time subscription");
      
      // Clear any pending batch timeout
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
        batchTimeoutRef.current = null;
      }
      
      // Clear pending updates
      pendingUpdatesRef.current.clear();
      
      // Remove channel
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        } catch (error) {
          console.warn("⚠️ Error cleaning up real-time channel:", error);
        }
      }
    };
  }, [user?.id, queueUpdate]);

  // Force immediate update (bypass batching)
  const forceUpdate = useCallback(() => {
    // Clear any pending batch
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
    
    pendingUpdatesRef.current.clear();
    return fetchJobs();
  }, [fetchJobs]);

  return {
    forceUpdate,
    hasPendingUpdates: () => pendingUpdatesRef.current.size > 0,
    getPendingJobIds: () => Array.from(pendingUpdatesRef.current)
  };
};
