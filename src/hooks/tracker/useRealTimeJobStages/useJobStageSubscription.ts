
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sets up and tears down a real-time subscription on job_stage_instances.
 * @param jobs Active jobs array to determine if subscription should run
 * @param onStageChanged Callback to fire on any job_stage_instances change.
 */
export function useJobStageSubscription(jobs: any[], onStageChanged: () => void) {
  useEffect(() => {
    if (jobs.length === 0) return;

    const channel = supabase
      .channel('job_stage_instances_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_stage_instances',
        },
        (payload) => {
          // optimistic updating is handled in main hook
          setTimeout(onStageChanged, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, onStageChanged]);
}
