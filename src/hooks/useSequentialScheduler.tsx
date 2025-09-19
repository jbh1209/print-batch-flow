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
      // Call the FIXED scheduler that eliminates convergence violations
      const { data, error } = await supabase.rpc('scheduler_reschedule_all_sequential_fixed_v2');
      
      if (error) {
        console.error('Error calling FIXED scheduler V2:', error);
        toast.error('Failed to generate schedule');
        return;
      }
      
      const result = (data as { wrote_slots: number; updated_jsi: number; violations: any }[] | null)?.[0];
      
      if (result) {
        const violationCount = Array.isArray(result.violations) ? result.violations.length : 0;
        if (violationCount === 0) {
          toast.success(`✅ Perfect schedule: ${result.updated_jsi} stages scheduled, ${result.wrote_slots} time slots created, 0 convergence violations!`);
        } else {
          toast.warning(`Schedule generated with ${violationCount} violations: ${result.updated_jsi} stages scheduled, ${result.wrote_slots} time slots created`);
        }
      } else {
        toast.success('Schedule generated successfully');
      }
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
      const { data, error } = await supabase.rpc('scheduler_append_jobs', {
        p_job_ids: jobIds,
        p_start_from: null,
        p_only_if_unset: true
      });
      
      if (error) {
        console.error('Error appending jobs:', error);
        toast.error('Failed to schedule jobs');
        return;
      }
      
      const result = (data as { wrote_slots: number; updated_jsi: number }[] | null)?.[0];
      toast.success(`Successfully scheduled ${result?.updated_jsi || 0} stages for ${jobIds.length} jobs`);
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

  const rescheduleJobs = useCallback(async (jobIds: string[]) => {
    setIsLoading(true);
    try {
      console.log('🔄 Rescheduling specific jobs:', jobIds);
      
      const { data, error } = await supabase.rpc('scheduler_append_jobs', {
        p_job_ids: jobIds,
        p_start_from: null,
        p_only_if_unset: false // Force reschedule even if already scheduled
      });
      
      if (error) {
        console.error('❌ Error rescheduling jobs:', error);
        toast.error(`Failed to reschedule jobs: ${error.message}`);
        return null;
      }

      const result = (data as { wrote_slots: number; updated_jsi: number }[] | null)?.[0];
      
      if (result) {
        toast.success(`✅ Rescheduled ${jobIds.length} job(s): ${result.updated_jsi} stages scheduled, ${result.wrote_slots} time slots created`);
        console.log('✅ Job reschedule completed:', result);
      } else {
        toast.success(`Rescheduled ${jobIds.length} job(s) successfully`);
      }
      
      return result;
    } catch (err) {
      console.error('❌ Error in job reschedule operation:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to reschedule jobs';
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
    carryForwardOverdueJobs,
    rescheduleJobs
  };
}