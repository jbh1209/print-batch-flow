
import { useEffect, useCallback, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DashboardStats {
  // Job stats (global)
  pendingJobs: number;
  printedToday: number;
  
  // Batch stats (global)
  activeBatches: number;
  bucketsFilled: number;
  batchTypeStats: {
    name: string;
    progress: number;
    total: number;
  }[];
  
  // Activity stats (user-specific)
  recentActivity: {
    id: string;
    name: string;
    action: string;
    type: string;
    timestamp: string;
  }[];
  
  // Loading and error states
  isLoading: boolean;
  error: string | null;
}

export const useDashboardStats = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    pendingJobs: 0,
    printedToday: 0,
    activeBatches: 0,
    bucketsFilled: 0,
    batchTypeStats: [],
    recentActivity: [],
    isLoading: true,
    error: null
  });

  const fetchStats = useCallback(async () => {
    if (authLoading || !user?.id) {
      setStats(prev => ({ ...prev, isLoading: false }));
      return;
    }
    
    try {
      setStats(prev => ({ ...prev, isLoading: true, error: null }));
      
      console.log("Fetching dashboard stats...");
      
      // Fetch job stats - count queued jobs
      const [businessCardJobs, flyerJobs, postcardJobs] = await Promise.allSettled([
        supabase.from("business_card_jobs").select("*", { count: 'exact' }).eq("status", "queued"),
        supabase.from("flyer_jobs").select("*", { count: 'exact' }).eq("status", "queued"),
        supabase.from("postcard_jobs").select("*", { count: 'exact' }).eq("status", "queued")
      ]);
      
      let totalPendingJobs = 0;
      
      if (businessCardJobs.status === 'fulfilled' && !businessCardJobs.value.error) {
        totalPendingJobs += businessCardJobs.value.count || 0;
      }
      
      if (flyerJobs.status === 'fulfilled' && !flyerJobs.value.error) {
        totalPendingJobs += flyerJobs.value.count || 0;
      }
      
      if (postcardJobs.status === 'fulfilled' && !postcardJobs.value.error) {
        totalPendingJobs += postcardJobs.value.count || 0;
      }
      
      // Fetch completed jobs today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      
      const [completedBusinessCards, completedFlyers, completedPostcards] = await Promise.allSettled([
        supabase.from("business_card_jobs").select("*", { count: 'exact' }).eq("status", "completed").gte("updated_at", todayISO),
        supabase.from("flyer_jobs").select("*", { count: 'exact' }).eq("status", "completed").gte("updated_at", todayISO),
        supabase.from("postcard_jobs").select("*", { count: 'exact' }).eq("status", "completed").gte("updated_at", todayISO)
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

      // Fetch active batches
      const { count: activeBatchesCount } = await supabase
        .from("batches")
        .select("*", { count: 'exact' })
        .in("status", ["pending", "processing"]);

      // Calculate batch type stats
      const batchTypeStats = [
        { name: "Business Cards", progress: Math.min(totalPendingJobs, 50), total: 50 },
        { name: "Flyers A5", progress: 0, total: 50 },
        { name: "Flyers A4", progress: 0, total: 50 },
        { name: "Postcards", progress: 0, total: 50 }
      ];
      
      const bucketsFilled = batchTypeStats.filter(
        type => (type.progress / type.total) >= 0.8
      ).length;

      // Fetch recent activity (user-specific) - using correct column names
      let recentActivity: any[] = [];
      if (user?.id) {
        const { data: activityData } = await supabase
          .from("business_card_jobs")
          .select("id, name, status, updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(5);

        recentActivity = (activityData || []).map(job => ({
          id: job.id,
          name: job.name || "Unnamed Job",
          action: "updated",
          type: "job",
          timestamp: job.updated_at
        }));
      }
      
      console.log("Dashboard stats calculated:", {
        totalPending: totalPendingJobs,
        completedToday: totalCompletedToday,
        activeBatches: activeBatchesCount || 0,
        bucketsFilled,
        recentActivity: recentActivity.length
      });
      
      setStats({
        pendingJobs: totalPendingJobs,
        printedToday: totalCompletedToday,
        activeBatches: activeBatchesCount || 0,
        bucketsFilled,
        batchTypeStats,
        recentActivity,
        isLoading: false,
        error: null
      });
      
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      setStats(prev => ({
        ...prev,
        isLoading: false,
        error: "Failed to load dashboard statistics"
      }));
      
      toast.error("Failed to load dashboard statistics");
    }
  }, [user?.id, authLoading]);

  // Load stats when auth is ready
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    ...stats,
    refresh: fetchStats
  };
};
