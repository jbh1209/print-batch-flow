/**
 * Hook for managing sequential job stage scheduling
 */

import { useState, useCallback } from "react";
import { calculateSequentialSchedule, updateScheduledTimes } from "@/utils/scheduler/productionScheduler";
import { type WorkingDayContainer } from "@/utils/scheduler/types";
import { toast } from "sonner";

export function useSequentialScheduler() {
  const [workingDays, setWorkingDays] = useState<WorkingDayContainer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const generateSchedule = useCallback(async () => {
    setIsLoading(true);
    try {
      const schedule = await calculateSequentialSchedule();
      setWorkingDays(schedule);
      toast.success(`Generated schedule for ${schedule.length} working days`);
    } catch (error) {
      console.error('Error generating schedule:', error);
      toast.error('Failed to generate schedule');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveSchedule = useCallback(async () => {
    if (workingDays.length === 0) {
      toast.error('No schedule to save');
      return;
    }

    setIsUpdating(true);
    try {
      const allStages = workingDays.flatMap(day => day.scheduled_stages);
      const success = await updateScheduledTimes(allStages);
      
      if (success) {
        toast.success('Schedule saved successfully');
      } else {
        toast.error('Failed to save schedule');
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast.error('Failed to save schedule');
    } finally {
      setIsUpdating(false);
    }
  }, [workingDays]);

  return {
    workingDays,
    isLoading,
    isUpdating,
    generateSchedule,
    saveSchedule
  };
}