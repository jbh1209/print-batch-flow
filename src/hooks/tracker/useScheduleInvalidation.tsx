/**
 * Hook for managing schedule invalidation and automatic updates
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ScheduleInvalidationConfig {
  autoReschedule?: boolean;
  showPreview?: boolean;
  scope?: 'single' | 'affected' | 'full';
}

export function useScheduleInvalidation() {
  const [isInvalidating, setIsInvalidating] = useState(false);
  const [pendingInvalidations, setPendingInvalidations] = useState<Set<string>>(new Set());

  const markForReschedule = useCallback((jobId: string, reason: string) => {
    console.log(`📅 Marking job ${jobId} for reschedule: ${reason}`);
    setPendingInvalidations(prev => new Set(prev).add(jobId));
  }, []);

  const clearPendingInvalidations = useCallback(() => {
    setPendingInvalidations(new Set());
  }, []);

  const detectScheduleImpact = useCallback(async (jobId: string) => {
    try {
      // Check if job has existing schedule data
      const { data: existingSlots, error } = await supabase
        .from('stage_time_slots')
        .select('id, job_id, production_stage_id')
        .eq('job_id', jobId)
        .eq('is_completed', false);

      if (error) {
        console.error('Error checking schedule impact:', error);
        return { hasScheduledSlots: false, affectedStages: 0 };
      }

      return {
        hasScheduledSlots: existingSlots && existingSlots.length > 0,
        affectedStages: existingSlots ? existingSlots.length : 0
      };
    } catch (error) {
      console.error('Error detecting schedule impact:', error);
      return { hasScheduledSlots: false, affectedStages: 0 };
    }
  }, []);

  const invalidateJobSchedule = useCallback(async (
    jobId: string, 
    config: ScheduleInvalidationConfig = {}
  ) => {
    setIsInvalidating(true);
    try {
      const impact = await detectScheduleImpact(jobId);
      
      if (impact.hasScheduledSlots) {
        console.log(`🗑️ Invalidating schedule for job ${jobId} (${impact.affectedStages} stages affected)`);
        
        // Clear existing schedule data for this job
        const { error: clearError } = await supabase
          .from('stage_time_slots')
          .delete()
          .eq('job_id', jobId)
          .eq('is_completed', false);

        if (clearError) {
          console.error('Error clearing schedule slots:', clearError);
          toast.error('Failed to clear existing schedule');
          return false;
        }

        // Reset job stage instances schedule status
        const { error: resetError } = await supabase
          .from('job_stage_instances')
          .update({
            schedule_status: 'unscheduled',
            scheduled_start_at: null,
            scheduled_end_at: null,
            scheduled_minutes: null,
            updated_at: new Date().toISOString()
          })
          .eq('job_id', jobId)
          .in('status', ['pending', 'scheduled']);

        if (resetError) {
          console.error('Error resetting job stage instances:', resetError);
          toast.error('Failed to reset stage schedule status');
          return false;
        }

        console.log(`✅ Schedule invalidated for job ${jobId}`);
        
        if (config.autoReschedule !== false) {
          markForReschedule(jobId, 'Workflow modified');
        }
        
        return true;
      } else {
        console.log(`ℹ️ Job ${jobId} has no scheduled slots to invalidate`);
        return true;
      }
    } catch (error) {
      console.error('Error invalidating job schedule:', error);
      toast.error('Failed to invalidate schedule');
      return false;
    } finally {
      setIsInvalidating(false);
    }
  }, [detectScheduleImpact, markForReschedule]);

  const getEstimatedImpact = useCallback(async (jobIds: string[]) => {
    try {
      const { data: affectedJobs, error } = await supabase
        .from('stage_time_slots')
        .select(`
          job_id,
          production_stage_id,
          slot_start_time,
          slot_end_time
        `)
        .in('job_id', jobIds)
        .eq('is_completed', false);

      if (error) {
        console.error('Error getting schedule impact:', error);
        return { affectedJobs: 0, affectedStages: 0, earliestStart: null, latestEnd: null };
      }

      const uniqueJobs = new Set(affectedJobs?.map(slot => slot.job_id) || []);
      const startTimes = affectedJobs?.map(slot => new Date(slot.slot_start_time)).filter(Boolean) || [];
      const endTimes = affectedJobs?.map(slot => new Date(slot.slot_end_time)).filter(Boolean) || [];

      return {
        affectedJobs: uniqueJobs.size,
        affectedStages: affectedJobs?.length || 0,
        earliestStart: startTimes.length > 0 ? new Date(Math.min(...startTimes.map(d => d.getTime()))) : null,
        latestEnd: endTimes.length > 0 ? new Date(Math.max(...endTimes.map(d => d.getTime()))) : null
      };
    } catch (error) {
      console.error('Error estimating schedule impact:', error);
      return { affectedJobs: 0, affectedStages: 0, earliestStart: null, latestEnd: null };
    }
  }, []);

  return {
    isInvalidating,
    pendingInvalidations: Array.from(pendingInvalidations),
    markForReschedule,
    clearPendingInvalidations,
    invalidateJobSchedule,
    detectScheduleImpact,
    getEstimatedImpact
  };
}