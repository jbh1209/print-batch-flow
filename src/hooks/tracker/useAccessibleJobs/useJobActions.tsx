
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
      // Update the job stage instance to active status
      const { data, error } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('job_id', jobId)
        .eq('production_stage_id', stageId)
        .eq('status', 'pending'); // Only update if currently pending

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
    
    try {
      // Use the advance_job_stage RPC function to properly complete and advance the job
      const { data, error } = await supabase.rpc('advance_job_stage', {
        p_job_id: jobId,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: stageId,
        p_completed_by: (await supabase.auth.getUser()).data.user?.id
      });

      if (error) {
        console.error('❌ Failed to complete job stage:', error);
        toast.error('Failed to complete job stage');
        return false;
      }

      console.log('✅ Job stage completed successfully');
      
      // Check if this was the final stage - if so, mark the entire job as completed
      const { data: remainingStages, error: stagesError } = await supabase
        .from('job_stage_instances')
        .select('id')
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .neq('status', 'completed');

      if (stagesError) {
        console.error('❌ Error checking remaining stages:', stagesError);
      } else if (!remainingStages || remainingStages.length === 0) {
        // No more stages - mark the entire job as completed
        console.log('🎯 All stages completed, marking job as completed');
        
        const { error: jobUpdateError } = await supabase
          .from('production_jobs')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);

        if (jobUpdateError) {
          console.error('❌ Failed to mark job as completed:', jobUpdateError);
          toast.error('Failed to mark job as completed');
        } else {
          console.log('✅ Job marked as completed successfully');
          toast.success('Job completed successfully!');
        }
      } else {
        toast.success('Job stage completed successfully');
      }
      
      onSuccess?.();
      return true;
    } catch (error) {
      console.error('❌ Error completing job:', error);
      toast.error('Failed to complete job');
      return false;
    }
  }, [onSuccess]);

  const markJobCompleted = useCallback(async (jobId: string): Promise<boolean> => {
    console.log('🎯 Directly marking job as completed:', { jobId });
    
    try {
      // First, mark all remaining stages as completed
      const { error: stageError } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .neq('status', 'completed');

      if (stageError) {
        console.error('❌ Failed to complete job stages:', stageError);
        toast.error('Failed to mark job stages as completed');
        return false;
      }

      // Then, mark the job itself as completed
      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (jobError) {
        console.error('❌ Failed to mark job as completed:', jobError);
        toast.error('Failed to mark job as completed');
        return false;
      }

      console.log('✅ Job marked as completed successfully');
      toast.success('Job marked as completed');
      
      // Ensure the UI is refreshed
      onSuccess?.();
      return true;
    } catch (error) {
      console.error('❌ Error marking job as completed:', error);
      toast.error('Failed to mark job as completed');
      return false;
    }
  }, [onSuccess]);

  const hasOptimisticUpdates = Object.keys(optimisticUpdates).length > 0;

  return {
    startJob,
    completeJob,
    markJobCompleted,
    optimisticUpdates,
    hasOptimisticUpdates
  };
};
