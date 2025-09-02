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
      // Call the new SQL-based scheduler directly
      const { data, error } = await supabase.rpc('simple_scheduler_wrapper', {
        p_mode: 'reschedule_all'
      });
      
      if (error) {
        console.error('Error calling SQL scheduler:', error);
        toast.error('Failed to generate schedule');
        return;
      }
      
      const result = data as { scheduled_count: number; wrote_slots: number; success: boolean; mode: string } | null;
      toast.success(`Successfully rescheduled ${result?.scheduled_count || 0} stages (${result?.wrote_slots || 0} time slots created)`);
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

  return {
    isLoading,
    generateSchedule,
    appendJobs
  };
}