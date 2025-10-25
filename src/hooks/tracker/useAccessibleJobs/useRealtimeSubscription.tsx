
import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface RealtimeSubscriptionOptions {
  onJobUpdate?: (jobId: string, updateType: 'status' | 'stage' | 'progress') => void;
  batchDelay?: number;
  divisionFilter?: string | null;
}

export const useRealtimeSubscription = (
  fetchJobs: () => Promise<void>,
  options: RealtimeSubscriptionOptions = {}
) => {
  const { user } = useAuth();
  const channelRef = useRef<any>(null);
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Set<string>>(new Set());
  
  const { onJobUpdate, batchDelay = 500, divisionFilter = null } = options;

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

  // Helper function to safely extract job ID from payload
  const getJobIdFromPayload = useCallback((payload: any): string | null => {
    const newRecord = payload.new;
    const oldRecord = payload.old;
    
    // Try to get ID from new record first, then old record
    if (newRecord && typeof newRecord === 'object' && 'id' in newRecord && newRecord.id) {
      return newRecord.id;
    }
    if (oldRecord && typeof oldRecord === 'object' && 'id' in oldRecord && oldRecord.id) {
      return oldRecord.id;
    }
    
    return null;
  }, []);

  // Helper function to safely extract job ID from job_stage_instances payload
  const getJobIdFromStagePayload = useCallback((payload: any): string | null => {
    const newRecord = payload.new;
    const oldRecord = payload.old;
    
    // Try to get job_id from new record first, then old record
    if (newRecord && typeof newRecord === 'object' && 'job_id' in newRecord && newRecord.job_id) {
      return newRecord.job_id;
    }
    if (oldRecord && typeof oldRecord === 'object' && 'job_id' in oldRecord && oldRecord.job_id) {
      return oldRecord.job_id;
    }
    
    return null;
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    console.log("🔄 Setting up enhanced real-time subscription for accessible jobs", {
      userId: user.id,
      divisionFilter
    });

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
              jobId: getJobIdFromPayload(payload)
            });
            
            const jobId = getJobIdFromPayload(payload);
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
            const jobId = getJobIdFromStagePayload(payload);
            const newRecord = payload.new;
            const oldRecord = payload.old;
            
            // Safely extract stage ID
            let stageId = null;
            if (newRecord && typeof newRecord === 'object' && 'production_stage_id' in newRecord) {
              stageId = newRecord.production_stage_id;
            } else if (oldRecord && typeof oldRecord === 'object' && 'production_stage_id' in oldRecord) {
              stageId = oldRecord.production_stage_id;
            }
            
            console.log('🎯 Job stage instances changed:', {
              event: payload.eventType,
              jobId,
              stageId
            });
            
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
  }, [user?.id, queueUpdate, getJobIdFromPayload, getJobIdFromStagePayload, divisionFilter]);

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
