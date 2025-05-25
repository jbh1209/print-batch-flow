
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface JobStats {
  pendingJobs: number;
  printedToday: number;
  isLoading: boolean;
  error: string | null;
}

export const useJobStats = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<JobStats>({
    pendingJobs: 0,
    printedToday: 0,
    isLoading: true,
    error: null
  });

  const fetchJobStats = useCallback(async () => {
    try {
      setStats(prev => ({ ...prev, isLoading: true, error: null }));
      
      console.log("Fetching global job stats...");
      
      // Fetch pending jobs from all job tables
      const [businessCardJobs, flyerJobs, postcardJobs] = await Promise.allSettled([
        supabase.from("business_card_jobs").select("id", { count: 'exact' }).eq("status", "queued"),
        supabase.from("flyer_jobs").select("id", { count: 'exact' }).eq("status", "queued"),
        supabase.from("postcard_jobs").select("id", { count: 'exact' }).eq("status", "queued")
      ]);
      
      let totalPendingJobs = 0;
      
      if (businessCardJobs.status === 'fulfilled' && !businessCardJobs.value.error) {
        totalPendingJobs += businessCardJobs.value.count || 0;
        console.log("Business card pending jobs:", businessCardJobs.value.count);
      }
      
      if (flyerJobs.status === 'fulfilled' && !flyerJobs.value.error) {
        totalPendingJobs += flyerJobs.value.count || 0;
        console.log("Flyer pending jobs:", flyerJobs.value.count);
      }
      
      if (postcardJobs.status === 'fulfilled' && !postcardJobs.value.error) {
        totalPendingJobs += postcardJobs.value.count || 0;
        console.log("Postcard pending jobs:", postcardJobs.value.count);
      }
      
      // Fetch completed jobs today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      
      const [completedBusinessCards, completedFlyers, completedPostcards] = await Promise.allSettled([
        supabase.from("business_card_jobs").select("id", { count: 'exact' }).eq("status", "completed").gte("updated_at", todayISO),
        supabase.from("flyer_jobs").select("id", { count: 'exact' }).eq("status", "completed").gte("updated_at", todayISO),
        supabase.from("postcard_jobs").select("id", { count: 'exact' }).eq("status", "completed").gte("updated_at", todayISO)
      ]);
      
      let totalCompletedToday = 0;
      
      if (completedBusinessCards.status === 'fulfilled' && !completedBusinessCards.value.error) {
        totalCompletedToday += completedBusinessCards.value.count || 0;
      }
      
      if (completedFlyers.status === 'fulfilled' && !completedFlyers.value.error) {
        totalCompletedToday += completedFlyers.value.count || 0;
      }
      
      if (completedPostcards.status === 'fulfilled' && !completedPostcards.value.error) {
        totalCompletedToday += completedPostcards.value.count || 0;
      }
      
      console.log("Job stats calculated:", {
        totalPending: totalPendingJobs,
        completedToday: totalCompletedToday
      });
      
      setStats({
        pendingJobs: totalPendingJobs,
        printedToday: totalCompletedToday,
        isLoading: false,
        error: null
      });
      
    } catch (error) {
      console.error("Error fetching job stats:", error);
      setStats(prev => ({
        ...prev,
        isLoading: false,
        error: "Failed to load job statistics"
      }));
      
      toast({
        title: "Error loading job statistics",
        description: "Failed to load job statistics. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]); // Only depend on toast

  return {
    ...stats,
    refresh: fetchJobStats
  };
};
