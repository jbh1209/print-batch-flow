
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useRealtimeSubscription = (fetchJobs: () => Promise<void>) => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    console.log("🔄 Setting up real-time subscription for accessible jobs");

    let channel: any = null;

    try {
      channel = supabase
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
            // Add a small delay to prevent race conditions
            setTimeout(() => {
              fetchJobs().catch(console.error);
            }, 100);
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
            // Add a small delay to prevent race conditions
            setTimeout(() => {
              fetchJobs().catch(console.error);
            }, 100);
          }
        )
        .subscribe((status) => {
          console.log("🔄 Real-time subscription status:", status);
          if (status === 'SUBSCRIPTION_ERROR') {
            console.warn("⚠️ Real-time subscription error, will continue without real-time updates");
          }
        });
    } catch (error) {
      console.warn("⚠️ Failed to set up real-time subscription:", error);
    }

    return () => {
      if (channel) {
        console.log("🧹 Cleaning up accessible jobs real-time subscription");
        try {
          supabase.removeChannel(channel);
        } catch (error) {
          console.warn("⚠️ Error cleaning up real-time channel:", error);
        }
      }
    };
  }, [fetchJobs, user?.id]);
};
