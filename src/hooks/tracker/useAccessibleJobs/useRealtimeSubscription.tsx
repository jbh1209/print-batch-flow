
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useRealtimeSubscription = (fetchJobs: () => Promise<void>) => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    console.log("🔄 Setting up real-time subscription for accessible jobs");

    const channel = supabase
      .channel(`accessible_jobs_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_jobs',
        },
        (payload) => {
          console.log('📦 Production jobs changed - refetching', payload.eventType);
          fetchJobs();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_stage_instances',
        },
        (payload) => {
          console.log('🎯 Job stage instances changed - refetching', payload.eventType);
          fetchJobs();
        }
      )
      .subscribe((status) => {
        console.log("🔄 Real-time subscription status:", status);
      });

    return () => {
      console.log("🧹 Cleaning up accessible jobs real-time subscription");
      supabase.removeChannel(channel);
    };
  }, [fetchJobs, user?.id]);
};
