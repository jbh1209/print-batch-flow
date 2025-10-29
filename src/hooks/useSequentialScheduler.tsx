/**
 * Hook for managing sequential job stage scheduling (Database-Centric)
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { rescheduleAll, scheduleJobs } from "@/utils/scheduler";
import { useDivision } from "@/contexts/DivisionContext";

export function useSequentialScheduler() {
  const [isLoading, setIsLoading] = useState(false);
  const { selectedDivision } = useDivision();

  const generateSchedule = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await rescheduleAll();
      
      if (result) {
        toast.success(
          `Schedule generated successfully! ${result.wrote_slots} slots written, ${result.updated_jsi} jobs updated.`
        );
      }
    } catch (error: any) {
      console.error('Failed to generate schedule:', error);
      toast.error(error.message || 'Failed to generate schedule');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const appendJobs = useCallback(async (jobIds: string[]) => {
    setIsLoading(true);
    try {
      const result = await scheduleJobs(jobIds, false);
      
      if (result) {
        toast.success(
          `Jobs scheduled successfully! ${result.wrote_slots} slots written.`
        );
      }
    } catch (error: any) {
      console.error('Failed to append jobs:', error);
      toast.error(error.message || 'Failed to append jobs');
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

  const rescheduleJobs = useCallback(async (jobIds: string[]) => {
    setIsLoading(true);
    try {
      const result = await scheduleJobs(jobIds, true);
      
      if (result) {
        toast.success(
          `Jobs rescheduled successfully! ${result.wrote_slots} slots written.`
        );
      }
    } catch (error: any) {
      console.error('Failed to reschedule jobs:', error);
      toast.error(error.message || 'Failed to reschedule jobs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    generateSchedule,
    appendJobs,
    carryForwardOverdueJobs,
    rescheduleJobs
  };
}