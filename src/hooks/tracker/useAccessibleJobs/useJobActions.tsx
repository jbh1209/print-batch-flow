
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { AccessibleJob } from "./types";

interface OptimisticUpdate {
  jobId: string;
  field: keyof AccessibleJob;
  originalValue: any;
  newValue: any;
  timestamp: number;
}

interface UseJobActionsOptions {
  onOptimisticUpdate?: (jobId: string, updates: Partial<AccessibleJob>) => void;
  onOptimisticRevert?: (jobId: string, field: keyof AccessibleJob, originalValue: any) => void;
}

export const useJobActions = (
  refreshJobs: () => Promise<void>,
  options: UseJobActionsOptions = {}
) => {
  const { user } = useAuth();
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, OptimisticUpdate[]>>(new Map());
  
  const { onOptimisticUpdate, onOptimisticRevert } = options;

  // Apply optimistic update
  const applyOptimisticUpdate = useCallback((
    jobId: string, 
    field: keyof AccessibleJob, 
    originalValue: any, 
    newValue: any
  ) => {
    const update: OptimisticUpdate = {
      jobId,
      field,
      originalValue,
      newValue,
      timestamp: Date.now()
    };

    setOptimisticUpdates(prev => {
      const newMap = new Map(prev);
      const jobUpdates = newMap.get(jobId) || [];
      newMap.set(jobId, [...jobUpdates, update]);
      return newMap;
    });

    // Notify parent component
    onOptimisticUpdate?.(jobId, { [field]: newValue });
  }, [onOptimisticUpdate]);

  // Revert optimistic update
  const revertOptimisticUpdate = useCallback((jobId: string, field: keyof AccessibleJob) => {
    setOptimisticUpdates(prev => {
      const newMap = new Map(prev);
      const jobUpdates = newMap.get(jobId) || [];
      const updateToRevert = jobUpdates.find(u => u.field === field);
      
      if (updateToRevert) {
        const filteredUpdates = jobUpdates.filter(u => u.field !== field);
        if (filteredUpdates.length === 0) {
          newMap.delete(jobId);
        } else {
          newMap.set(jobId, filteredUpdates);
        }
        
        // Notify parent component
        onOptimisticRevert?.(jobId, field, updateToRevert.originalValue);
      }
      
      return newMap;
    });
  }, [onOptimisticRevert]);

  // Clear all optimistic updates for a job
  const clearOptimisticUpdates = useCallback((jobId: string) => {
    setOptimisticUpdates(prev => {
      const newMap = new Map(prev);
      newMap.delete(jobId);
      return newMap;
    });
  }, []);

  const startJob = useCallback(async (jobId: string, stageId: string) => {
    if (!user?.id) {
      toast.error("User not authenticated");
      return false;
    }

    try {
      console.log('🚀 Starting job stage with optimistic update:', { jobId, stageId, userId: user.id });
      
      // Apply optimistic update
      applyOptimisticUpdate(jobId, 'current_stage_status', 'pending', 'active');
      
      // Show immediate feedback
      toast.success("Starting job...", { duration: 1000 });

      // Find the first pending stage for this job and set it to active
      const { data: firstPendingStage, error: findError } = await supabase
        .from('job_stage_instances')
        .select('id, production_stage_id, stage_order')
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .eq('status', 'pending')
        .order('stage_order', { ascending: true })
        .limit(1)
        .single();

      if (findError || !firstPendingStage) {
        console.error("❌ No pending stage found:", findError);
        revertOptimisticUpdate(jobId, 'current_stage_status');
        toast.error("No pending stage found to start");
        return false;
      }

      // Start the first pending stage
      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', firstPendingStage.id);

      if (error) {
        console.error("❌ Error starting job stage:", error);
        revertOptimisticUpdate(jobId, 'current_stage_status');
        throw error;
      }

      console.log("✅ Job stage started successfully");
      toast.success("Job started successfully");
      
      // Clear optimistic updates since real data will come from subscription
      clearOptimisticUpdates(jobId);
      
      return true;
    } catch (err) {
      console.error('❌ Error starting job:', err);
      revertOptimisticUpdate(jobId, 'current_stage_status');
      const errorMessage = err instanceof Error ? err.message : "Failed to start job";
      toast.error(errorMessage);
      return false;
    }
  }, [user?.id, applyOptimisticUpdate, revertOptimisticUpdate, clearOptimisticUpdates]);

  const completeJob = useCallback(async (jobId: string, stageId: string) => {
    if (!user?.id) {
      toast.error("User not authenticated");
      return false;
    }

    try {
      console.log('✅ Completing job stage with optimistic update:', { jobId, stageId, userId: user.id });
      
      // Apply optimistic update
      applyOptimisticUpdate(jobId, 'current_stage_status', 'active', 'completed');
      
      // Show immediate feedback
      toast.success("Completing stage...", { duration: 1000 });

      // Find the active stage for this job
      const { data: activeStage, error: findError } = await supabase
        .from('job_stage_instances')
        .select('id, production_stage_id, stage_order')
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .eq('status', 'active')
        .single();

      if (findError || !activeStage) {
        console.error("❌ No active stage found:", findError);
        revertOptimisticUpdate(jobId, 'current_stage_status');
        toast.error("No active stage found to complete");
        return false;
      }

      // Complete the current stage
      const { error: completeError } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', activeStage.id);

      if (completeError) {
        console.error("❌ Error completing stage:", completeError);
        revertOptimisticUpdate(jobId, 'current_stage_status');
        throw completeError;
      }

      // Check if there's a next stage to activate
      const { data: nextStage, error: nextError } = await supabase
        .from('job_stage_instances')
        .select('id')
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .eq('status', 'pending')
        .gt('stage_order', activeStage.stage_order)
        .order('stage_order', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextError) {
        console.error("❌ Error finding next stage:", nextError);
        // Don't fail the completion, just log the error
      } else if (nextStage) {
        // Activate the next stage
        const { error: activateError } = await supabase
          .from('job_stage_instances')
          .update({ 
            status: 'active',
            started_at: new Date().toISOString(),
            started_by: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', nextStage.id);

        if (activateError) {
          console.error("❌ Error activating next stage:", activateError);
          // Don't fail the completion, just log the error
        }
      }

      console.log("✅ Job stage completed successfully");
      toast.success("Job stage completed successfully");
      
      // Clear optimistic updates since real data will come from subscription
      clearOptimisticUpdates(jobId);
      
      return true;
    } catch (err) {
      console.error('❌ Error completing job:', err);
      revertOptimisticUpdate(jobId, 'current_stage_status');
      const errorMessage = err instanceof Error ? err.message : "Failed to complete job";
      toast.error(errorMessage);
      return false;
    }
  }, [user?.id, applyOptimisticUpdate, revertOptimisticUpdate, clearOptimisticUpdates]);

  return { 
    startJob, 
    completeJob,
    optimisticUpdates: Array.from(optimisticUpdates.entries()),
    clearOptimisticUpdates,
    hasOptimisticUpdates: (jobId: string) => optimisticUpdates.has(jobId)
  };
};
