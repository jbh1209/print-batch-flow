/**
 * Hook for managing sequential job stage scheduling (Database-Centric)
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useChunkedScheduler } from "./useChunkedScheduler";

export function useSequentialScheduler() {
  const [isLoading, setIsLoading] = useState(false);
  const { rescheduleAllChunked, appendJobsChunked } = useChunkedScheduler();

  const generateSchedule = useCallback(async () => {
    setIsLoading(true);
    try {
      const { totals, progress } = await rescheduleAllChunked();
      
      if (progress.failed > 0) {
        toast.warning(`Rescheduled ${totals.updated_jsi} stages (${totals.wrote_slots} slots), but ${progress.failed} jobs failed`);
      } else {
        toast.success(`Successfully rescheduled ${totals.updated_jsi} stages (${totals.wrote_slots} time slots created)`);
      }
    } catch (error) {
      console.error('Error generating schedule:', error);
      toast.error('Failed to generate schedule');
    } finally {
      setIsLoading(false);
    }
  }, [rescheduleAllChunked]);

  const appendJobs = useCallback(async (jobIds: string[]) => {
    setIsLoading(true);
    try {
      const { totals, progress } = await appendJobsChunked(jobIds);
      
      if (progress.failed > 0) {
        toast.warning(`Scheduled ${totals.updated_jsi} stages for ${jobIds.length} jobs, but ${progress.failed} jobs failed`);
      } else {
        toast.success(`Successfully scheduled ${totals.updated_jsi} stages for ${jobIds.length} jobs`);
      }
    } catch (error) {
      console.error('Error appending jobs:', error);
      toast.error('Failed to schedule jobs');
    } finally {
      setIsLoading(false);
    }
  }, [appendJobsChunked]);

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