
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
      
      // Fetch pending jobs - simplified queries
      const [businessCardResult, flyerResult, postcardResult] = await Promise.allSettled([
        supabase.from("business_card_jobs").select("*", { count: 'exact' }).eq("status", "queued"),
        supabase.from("flyer_jobs").select("*", { count: 'exact' }).eq("status", "queued"),
        supabase.from("postcard_jobs").select("*", { count: 'exact' }).eq("status", "queued")
      ]);
      
      const pendingJobs = [businessCardResult, flyerResult, postcardResult]
        .reduce((total, result) => {
          if (result.status === 'fulfilled' && !result.value.error) {
            return total + (result.value.count || 0);
          }
          return total;
        }, 0);
      
      // Fetch completed jobs today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      
      const [completedBCResult, completedFlyerResult, completedPCResult] = await Promise.allSettled([
        supabase.from("business_card_jobs").select("*", { count: 'exact' }).eq("status", "completed").gte("updated_at", todayISO),
        supabase.from("flyer_jobs").select("*", { count: 'exact' }).eq("status", "completed").gte("updated_at", todayISO),
        supabase.from("postcard_jobs").select("*", { count: 'exact' }).eq("status", "completed").gte("updated_at", todayISO)
      ]);
      
      const printedToday = [completedBCResult, completedFlyerResult, completedPCResult]
        .reduce((total, result) => {
          if (result.status === 'fulfilled' && !result.value.error) {
            return total + (result.value.count || 0);
          }
          return total;
        }, 0);

      // Fetch active batches
      const { count: activeBatches } = await supabase
        .from("batches")
        .select("*", { count: 'exact' })
        .in("status", ["pending", "processing"]);

      // Calculate batch type stats
      const batchTypeStats = [
        { name: "Business Cards", progress: Math.min(pendingJobs, 50), total: 50 },
        { name: "Flyers A5", progress: 0, total: 50 },
        { name: "Flyers A4", progress: 0, total: 50 },
        { name: "Postcards", progress: 0, total: 50 }
      ];
      
      const bucketsFilled = batchTypeStats.filter(
        type => (type.progress / type.total) >= 0.8
      ).length;

      // Fetch recent activity (user-specific)
      const { data: activityData } = await supabase
        .from("business_card_jobs")
        .select("id, name, status, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(5);

      const recentActivity = (activityData || []).map(job => ({
        id: job.id,
        name: job.name || "Unnamed Job",
        action: "updated",
        type: "job",
        timestamp: job.updated_at
      }));
      
      console.log("Dashboard stats calculated:", {
        pendingJobs,
        printedToday,
        activeBatches: activeBatches || 0,
        bucketsFilled,
        recentActivity: recentActivity.length
      });
      
      setStats({
        pendingJobs,
        printedToday,
        activeBatches: activeBatches || 0,
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

  // Load stats when dependencies change
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    ...stats,
    refresh: fetchStats
  };
};
