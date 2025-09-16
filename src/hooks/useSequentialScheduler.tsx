/**
 * Hook for managing sequential job stage scheduling (Database-Centric)
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useSequentialScheduler() {
  const [isLoading, setIsLoading] = useState(false);

  const generateSchedule = useCallback(async () => {
    setIsLoading(true);
    try {
      // Direct RPC to avoid Edge Function timeout
      const { data, error } = await supabase.rpc('scheduler_reschedule_all_parallel_aware_edge');
      
      if (error) {
        console.error('Error calling reschedule RPC:', error);
        toast.error('Failed to generate schedule');
        return;
      }
      
      const row = Array.isArray(data) ? data[0] : data;
      const scheduledCount = row?.updated_jsi ?? 0;
      const wroteSlots = row?.wrote_slots ?? 0;
      toast.success(`Successfully rescheduled ${scheduledCount} stages (${wroteSlots} time slots created)`);
    } catch (error) {
      console.error('Error generating schedule:', error);
      toast.error('Failed to generate schedule');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const appendJobs = useCallback(async (jobIds: string[]) => {
    setIsLoading(true);
    try {
      // Append specific jobs via RPC (timeout-safe)
      const { data, error } = await supabase.rpc('scheduler_append_jobs_edge', {
        p_job_ids: jobIds,
        p_start_from: null,
        p_only_if_unset: true,
      });
      
      if (error) {
        console.error('Error appending jobs via RPC:', error);
        toast.error('Failed to schedule jobs');
        return;
      }
      
      const row = Array.isArray(data) ? data[0] : data;
      const scheduledCount = row?.updated_jsi ?? 0;
      const wroteSlots = row?.wrote_slots ?? 0;
      toast.success(`Successfully scheduled ${scheduledCount} stages for ${jobIds.length} jobs`);
    } catch (error) {
      console.error('Error appending jobs:', error);
      toast.error('Failed to schedule jobs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const carryForwardOverdueJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Manually triggering carry-forward of overdue active jobs...');
      
      const { data, error } = await supabase.rpc('carry_forward_overdue_active_jobs');
      
      if (error) {
        console.error('❌ Error carrying forward jobs:', error);
        toast.error(`Failed to carry forward jobs: ${error.message}`);
        return null;
      }

      const result = data[0] as { carried_forward_count: number; job_details: string[] };
      
      if (result.carried_forward_count > 0) {
        toast.success(
          `Carried forward ${result.carried_forward_count} overdue jobs: ${result.job_details.join(', ')}`
        );
        console.log('✅ Carry-forward completed:', result);
      } else {
        toast.info('No overdue active jobs found to carry forward');
        console.log('ℹ️ No overdue jobs found');
      }
      
      return result;
    } catch (err) {
      console.error('❌ Error in carry-forward operation:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to carry forward jobs';
      toast.error(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    generateSchedule,
    appendJobs,
    carryForwardOverdueJobs
  };
}