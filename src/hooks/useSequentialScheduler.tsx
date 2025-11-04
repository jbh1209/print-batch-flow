/**
 * Hook for managing sequential job stage scheduling (Database-Centric)
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { rescheduleAll, scheduleJobs } from "@/utils/scheduler";
import { SchedulerResult, GapFillRecord } from "@/types/scheduler";

export function useSequentialScheduler() {
  const [isLoading, setIsLoading] = useState(false);

  const generateSchedule = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await rescheduleAll();
      if (!result) return;
      
      const violationCount = result.violations.length;
      
      // Check if there were any gap-filled stages
      const { data: gapFillData } = await supabase
        .from('schedule_gap_fills')
        .select('*')
        .eq('scheduler_run_type', 'reschedule_all')
        .order('created_at', { ascending: false })
        .limit(100);
      
      const recentGapFills = (gapFillData || []).filter((gf: any) => {
        const timeDiff = Date.now() - new Date(gf.created_at).getTime();
        return timeDiff < 10000; // Within last 10 seconds
      });
      
      const gapFilledCount = recentGapFills.length;
      const totalDaysSaved = recentGapFills.reduce((sum: number, gf: any) => sum + (gf.days_saved || 0), 0);
      
      if (violationCount === 0 && gapFilledCount === 0) {
        toast.success(`✅ Perfect schedule: ${result.updated_jsi} stages scheduled, ${result.wrote_slots} time slots created, 0 validation notes!`);
      } else if (gapFilledCount > 0) {
        toast.success(
          `✅ Scheduled ${result.updated_jsi} stages with ${result.wrote_slots} slots. 🔀 Gap-filled ${gapFilledCount} stages (saved ${totalDaysSaved.toFixed(1)} days total)!`,
          {
            description: violationCount > 0 ? `${violationCount} parallel processing info items (normal for cover/text stages)` : undefined
          }
        );
      } else {
        toast.message(
          `✅ Scheduled ${result.updated_jsi} stages with ${result.wrote_slots} slots. ${violationCount} parallel processing info items (normal for cover/text stages)`,
          {
            description: "Click on any job to see 'Why scheduled here?' details"
          }
        );
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
      const result = await scheduleJobs(jobIds, false);
      if (!result) return;
      
      toast.success(`Successfully scheduled ${result.updated_jsi} stages for ${jobIds.length} jobs`);
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
      
      const result = await scheduleJobs(jobIds, true); // Force reschedule
      if (!result) return null;
      
      toast.success(`✅ Rescheduled ${jobIds.length} job(s): ${result.updated_jsi} stages scheduled, ${result.wrote_slots} time slots created`);
      console.log('✅ Job reschedule completed:', result);
      
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