/**
 * Hook for managing sequential job stage scheduling
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useSequentialScheduler() {
  const [isLoading, setIsLoading] = useState(false);

  const generateSchedule = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('simple-scheduler', {
        body: { mode: 'reschedule_all' }
      });
      
      if (error) {
        console.error('Error calling scheduler:', error);
        toast.error('Failed to generate schedule');
        return;
      }
      
      toast.success(`Successfully rescheduled ${data?.scheduled_count || 0} stages`);
    } catch (error) {
      console.error('Error generating schedule:', error);
      toast.error('Failed to generate schedule');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    generateSchedule
  };
}