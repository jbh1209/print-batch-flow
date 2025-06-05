
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OptimisticCallbacks {
  onOptimisticUpdate?: (jobId: string, updates: any) => void;
  onOptimisticRevert?: (jobId: string, field: string, originalValue: any) => void;
}

export const useJobActions = (
  onSuccess?: () => void,
  callbacks?: OptimisticCallbacks
) => {
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, any>>({});

  const startJob = useCallback(async (jobId: string, stageId: string): Promise<boolean> => {
    console.log('🎬 Starting job:', { jobId, stageId });
    
    // Optimistic update
    const originalStatus = 'pending';
    callbacks?.onOptimisticUpdate?.(jobId, { current_stage_status: 'active' });
    setOptimisticUpdates(prev => ({ ...prev, [jobId]: { current_stage_status: 'active' } }));

    try {
      const { data, error } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('job_id', jobId)
        .eq('production_stage_id', stageId)
        .eq('status', 'pending');

      if (error) {
        console.error('❌ Failed to start job:', error);
        // Revert optimistic update
        callbacks?.onOptimisticRevert?.(jobId, 'current_stage_status', originalStatus);
        setOptimisticUpdates(prev => {
          const updated = { ...prev };
          delete updated[jobId];
          return updated;
        });
        toast.error('Failed to start job');
        return false;
      }

      console.log('✅ Job started successfully');
      toast.success('Job started successfully');
      
      // Clear optimistic update and refresh
      setOptimisticUpdates(prev => {
        const updated = { ...prev };
        delete updated[jobId];
        return updated;
      });
      
      onSuccess?.();
      return true;
    } catch (error) {
      console.error('❌ Error starting job:', error);
      // Revert optimistic update
      callbacks?.onOptimisticRevert?.(jobId, 'current_stage_status', originalStatus);
      setOptimisticUpdates(prev => {
        const updated = { ...prev };
        delete updated[jobId];
        return updated;
      });
      toast.error('Failed to start job');
      return false;
    }
  }, [callbacks, onSuccess]);

  const completeJob = useCallback(async (jobId: string, stageId: string): Promise<boolean> => {
    console.log('✅ Completing job:', { jobId, stageId });
    
    // Optimistic update
    const originalStatus = 'active';
    callbacks?.onOptimisticUpdate?.(jobId, { current_stage_status: 'completed' });
    setOptimisticUpdates(prev => ({ ...prev, [jobId]: { current_stage_status: 'completed' } }));

    try {
      const { data, error } = await supabase.rpc('advance_job_stage', {
        p_job_id: jobId,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: stageId,
        p_completed_by: (await supabase.auth.getUser()).data.user?.id
      });

      if (error) {
        console.error('❌ Failed to complete job:', error);
        // Revert optimistic update
        callbacks?.onOptimisticRevert?.(jobId, 'current_stage_status', originalStatus);
        setOptimisticUpdates(prev => {
          const updated = { ...prev };
          delete updated[jobId];
          return updated;
        });
        toast.error('Failed to complete job');
        return false;
      }

      console.log('✅ Job completed successfully');
      toast.success('Job completed successfully');
      
      // Clear optimistic update and refresh
      setOptimisticUpdates(prev => {
        const updated = { ...prev };
        delete updated[jobId];
        return updated;
      });
      
      onSuccess?.();
      return true;
    } catch (error) {
      console.error('❌ Error completing job:', error);
      // Revert optimistic update
      callbacks?.onOptimisticRevert?.(jobId, 'current_stage_status', originalStatus);
      setOptimisticUpdates(prev => {
        const updated = { ...prev };
        delete updated[jobId];
        return updated;
      });
      toast.error('Failed to complete job');
      return false;
    }
  }, [callbacks, onSuccess]);

  const hasOptimisticUpdates = Object.keys(optimisticUpdates).length > 0;

  return {
    startJob,
    completeJob,
    optimisticUpdates,
    hasOptimisticUpdates
  };
};
