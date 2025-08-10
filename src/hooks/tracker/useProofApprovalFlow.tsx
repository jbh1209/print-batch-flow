import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { schedulingService } from "@/services/schedulingService";
import { toast } from "sonner";

/**
 * Hook for handling the proof approval flow and triggering queue-based due date calculations
 */
export const useProofApprovalFlow = () => {
  
  /**
   * Trigger queue-based due date calculation after proof approval
   */
  const triggerQueueBasedCalculation = useCallback(async (jobId: string) => {
    try {
      console.log(`🎯 Triggering queue-based due date calculation for job ${jobId}`);
      
      // Call the edge function to perform complex queue calculations
      const { data, error } = await supabase.functions.invoke('calculate-due-dates', {
        body: {
          jobIds: [jobId],
          tableName: 'production_jobs',
          priority: 'high',
          triggerReason: 'proof_approval'
        }
      });

      if (error) {
        console.error('Error triggering queue-based calculation:', error);
        toast.error('Failed to update due date after proof approval');
        return false;
      }

      console.log(`✅ Queue-based calculation triggered:`, data);
      toast.success('Due date updated based on current production queue');
      return true;

    } catch (error) {
      console.error('Error in triggerQueueBasedCalculation:', error);
      toast.error('Failed to update due date');
      return false;
    }
  }, []);

  /**
   * Complete proof stage and move to next stage with queue calculation
   */
  const completeProofStage = useCallback(async (jobId: string, stageId: string) => {
    try {
      console.log(`📋 Completing proof stage for job ${jobId}`);
      
      // First complete the proof stage
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

      // Trigger queue-based due date calculation and auto-schedule downstream stages
      await triggerQueueBasedCalculation(jobId);
      try {
        await schedulingService.scheduleOnApproval({ job_id: jobId, job_table_name: 'production_jobs' });
        console.log('🗓️ Auto-scheduled approved job', jobId);
      } catch (e) {
        console.warn('Auto-schedule invoke failed', e);
      }

      // Find and activate next stage
      const { data: nextStage, error: nextStageError } = await supabase
        .from('job_stage_instances')
        .select('id, stage_order')
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .eq('status', 'pending')
        .order('stage_order', { ascending: true })
        .limit(1)
        .single();

      if (!nextStageError && nextStage) {
        const { error: activateError } = await supabase
          .from('job_stage_instances')
          .update({
            status: 'active',
            started_at: new Date().toISOString(),
            started_by: (await supabase.auth.getUser()).data.user?.id,
          })
          .eq('id', nextStage.id);

        if (activateError) {
          console.error('Error activating next stage:', activateError);
        } else {
          console.log(`✅ Next stage activated for job ${jobId}`);
        }
      }

      toast.success('Proof approved and job moved to production queue');
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