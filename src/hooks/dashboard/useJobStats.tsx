
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { castToUUID } from "@/utils/database/dbHelpers";

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
    if (!userId) return;
    
    try {
      setStats(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Fetch pending business card jobs
      const { data: pendingBusinessCardJobs, error: businessCardJobsError } = await supabase
        .from("business_card_jobs")
        .select("id")
        .eq("user_id", castToUUID(userId))
        .eq("status", castToUUID("queued") as any);
      
      if (businessCardJobsError) throw businessCardJobsError;
      
      // Fetch pending flyer jobs
      const { data: pendingFlyerJobs, error: flyerJobsError } = await supabase
        .from("flyer_jobs")
        .select("id")
        .eq("user_id", castToUUID(userId))
        .eq("status", castToUUID("queued") as any);
      
      if (flyerJobsError) throw flyerJobsError;
      
      // Calculate total pending jobs
      const totalPendingJobs = (pendingBusinessCardJobs?.length || 0) + (pendingFlyerJobs?.length || 0);
      
      // Fetch jobs completed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: completedTodayBusinessCards, error: completedBusinessCardsError } = await supabase
        .from("business_card_jobs")
        .select("id")
        .eq("user_id", castToUUID(userId))
        .eq("status", castToUUID("completed") as any)
        .gte("updated_at", today.toISOString());
      
      if (completedBusinessCardsError) throw completedBusinessCardsError;
      
      const { data: completedTodayFlyers, error: completedFlyersError } = await supabase
        .from("flyer_jobs")
        .select("id")
        .eq("user_id", castToUUID(userId))
        .eq("status", castToUUID("completed") as any)
        .gte("updated_at", today.toISOString());
      
      if (completedFlyersError) throw completedFlyersError;
      
      const totalCompletedToday = (completedTodayBusinessCards?.length || 0) + (completedTodayFlyers?.length || 0);
      
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
