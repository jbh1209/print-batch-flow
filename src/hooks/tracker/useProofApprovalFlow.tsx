import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { scheduleJobs } from "@/utils/scheduler";
import { toast } from "sonner";

/**
 * Hook for handling the proof approval flow and triggering queue-based due date calculations
 */
export const useProofApprovalFlow = () => {
  
  /**
   * Trigger queue-based scheduling after proof approval
   */
  const triggerQueueBasedCalculation = useCallback(async (jobId: string) => {
    try {
      console.log(`🎯 Triggering scheduling for job ${jobId} after proof approval`);
      
      // Use the working scheduleJobs utility that calls scheduler_append_jobs RPC
      const result = await scheduleJobs([jobId], false);

      if (!result) {
        console.error('Error triggering scheduler: No result returned');
        toast.error('Failed to schedule job after proof approval');
        return false;
      }

      console.log(`✅ Job scheduled successfully:`, result);
      toast.success('Job added to production schedule');
      return true;

    } catch (error) {
      console.error('Error in triggerQueueBasedCalculation:', error);
      toast.error('Failed to schedule job');
      return false;
    }
  }, []);

  /**
   * Complete proof stage WITHOUT auto-activating next stage - for manual factory floor control
   */
  const completeProofStage = useCallback(async (jobId: string, stageId: string) => {
    try {
      console.log(`📋 Completing proof stage for job ${jobId} - NO auto-activation`);
      
      // Complete the proof stage - database trigger will sync production_jobs.proof_approved_at
      const { error: completeError } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: (await supabase.auth.getUser()).data.user?.id,
          proof_approved_manually_at: new Date().toISOString(),
        })
        .eq('id', stageId);

      if (completeError) {
        throw completeError;
      }

      // Trigger queue-based due date calculation for scheduling
      await triggerQueueBasedCalculation(jobId);
      
      // CRITICAL: DO NOT auto-activate next stage for proof completions
      // Next stage will remain "pending" for manual factory floor activation
      console.log(`✅ Proof stage completed for job ${jobId} - next stage remains pending for manual activation`);

      toast.success('Proof approved - next stage awaits manual factory floor activation');
      return true;

    } catch (error) {
      console.error('Error completing proof stage:', error);
      toast.error('Failed to complete proof stage');
      return false;
    }
  }, [triggerQueueBasedCalculation]);

  /**
   * Trigger 3 AM recalculation for all jobs
   */
  const trigger3amRecalculation = useCallback(async () => {
    try {
      console.log(`🌅 Triggering 3 AM recalculation...`);
      
      const { data, error } = await supabase.functions.invoke('calculate-due-dates', {
        body: {
          priority: 'low',
          triggerReason: '3am_recalculation'
        }
      });

      if (error) {
        console.error('Error in 3 AM recalculation:', error);
        return false;
      }

      console.log(`✅ 3 AM recalculation completed:`, data);
      return true;

    } catch (error) {
      console.error('Error in trigger3amRecalculation:', error);
      return false;
    }
  }, []);

  return {
    triggerQueueBasedCalculation,
    completeProofStage,
    trigger3amRecalculation
  };
};