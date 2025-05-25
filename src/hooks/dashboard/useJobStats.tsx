
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface JobStats {
  pendingJobs: number;
  printedToday: number;
  isLoading: boolean;
  error: string | null;
}

export const useJobStats = (userId: string | undefined) => {
  const { toast } = useToast();
  const [stats, setStats] = useState<JobStats>({
    pendingJobs: 0,
    printedToday: 0,
    isLoading: true,
    error: null
  });

  const fetchJobStats = async () => {
    try {
      setStats(prev => ({ ...prev, isLoading: true, error: null }));
      
      console.log("Fetching job stats...");
      
      // Fetch pending business card jobs
      const { data: pendingBusinessCardJobs, error: businessCardJobsError } = await supabase
        .from("business_card_jobs")
        .select("id")
        .eq("status", "queued");
      
      if (businessCardJobsError) {
        console.error("Error fetching business card jobs:", businessCardJobsError);
        throw businessCardJobsError;
      }
      
      // Fetch pending flyer jobs
      const { data: pendingFlyerJobs, error: flyerJobsError } = await supabase
        .from("flyer_jobs")
        .select("id")
        .eq("status", "queued");
      
      if (flyerJobsError) {
        console.error("Error fetching flyer jobs:", flyerJobsError);
        throw flyerJobsError;
      }
      
      // Fetch pending postcard jobs
      const { data: pendingPostcardJobs, error: postcardJobsError } = await supabase
        .from("postcard_jobs")
        .select("id")
        .eq("status", "queued");
      
      if (postcardJobsError) {
        console.error("Error fetching postcard jobs:", postcardJobsError);
        throw postcardJobsError;
      }
      
      // Calculate total pending jobs
      const totalPendingJobs = (pendingBusinessCardJobs?.length || 0) + 
                              (pendingFlyerJobs?.length || 0) + 
                              (pendingPostcardJobs?.length || 0);
      
      // Fetch jobs completed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      
      const { data: completedTodayBusinessCards, error: completedBusinessCardsError } = await supabase
        .from("business_card_jobs")
        .select("id")
        .eq("status", "completed")
        .gte("updated_at", todayISO);
      
      if (completedBusinessCardsError) {
        console.error("Error fetching completed business cards:", completedBusinessCardsError);
        throw completedBusinessCardsError;
      }
      
      const { data: completedTodayFlyers, error: completedFlyersError } = await supabase
        .from("flyer_jobs")
        .select("id")
        .eq("status", "completed")
        .gte("updated_at", todayISO);
      
      if (completedFlyersError) {
        console.error("Error fetching completed flyers:", completedFlyersError);
        throw completedFlyersError;
      }
      
      const { data: completedTodayPostcards, error: completedPostcardsError } = await supabase
        .from("postcard_jobs")
        .select("id")
        .eq("status", "completed")
        .gte("updated_at", todayISO);
      
      if (completedPostcardsError) {
        console.error("Error fetching completed postcards:", completedPostcardsError);
        throw completedPostcardsError;
      }
      
      const totalCompletedToday = (completedTodayBusinessCards?.length || 0) + 
                                 (completedTodayFlyers?.length || 0) + 
                                 (completedTodayPostcards?.length || 0);
      
      console.log("Job stats calculated:", {
        pendingBusinessCards: pendingBusinessCardJobs?.length || 0,
        pendingFlyers: pendingFlyerJobs?.length || 0,
        pendingPostcards: pendingPostcardJobs?.length || 0,
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
  };

  return {
    ...stats,
    refresh: fetchJobStats
  };
};
