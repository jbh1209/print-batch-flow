
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DashboardStats {
  activeBatches: number;
  pendingJobs: number;
  printedToday: number;
  bucketsFilled: number;
  batchTypeStats: {
    name: string;
    progress: number;
    total: number;
  }[];
  recentActivity: {
    id: string;
    type: 'job' | 'batch';
    name: string;
    action: string;
    timestamp: string;
  }[];
  isLoading: boolean;
  error: string | null;
}

export const useDashboardStats = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    activeBatches: 0,
    pendingJobs: 0,
    printedToday: 0,
    bucketsFilled: 0,
    batchTypeStats: [],
    recentActivity: [],
    isLoading: true,
    error: null
  });

  const fetchDashboardStats = async () => {
    if (!user) return;
    
    try {
      setStats(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Fetch active batches (batches with status 'pending' or 'processing')
      const { data: activeBatches, error: batchesError } = await supabase
        .from("batches")
        .select("id")
        .eq("created_by", user.id)
        .in("status", ["pending", "processing"]);
      
      if (batchesError) throw batchesError;
      
      // Fetch pending business card jobs (jobs with status 'queued')
      const { data: pendingBusinessCardJobs, error: businessCardJobsError } = await supabase
        .from("business_card_jobs")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "queued");
      
      if (businessCardJobsError) throw businessCardJobsError;
      
      // Fetch pending flyer jobs (jobs with status 'queued')
      // Updated to also select the size property
      const { data: pendingFlyerJobs, error: flyerJobsError } = await supabase
        .from("flyer_jobs")
        .select("id, size")
        .eq("user_id", user.id)
        .eq("status", "queued");
      
      if (flyerJobsError) throw flyerJobsError;
      
      // Calculate total pending jobs from all job types
      const totalPendingJobs = (pendingBusinessCardJobs?.length || 0) + (pendingFlyerJobs?.length || 0);
      
      // Fetch jobs completed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: completedTodayBusinessCards, error: completedBusinessCardsError } = await supabase
        .from("business_card_jobs")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("updated_at", today.toISOString());
      
      if (completedBusinessCardsError) throw completedBusinessCardsError;
      
      const { data: completedTodayFlyers, error: completedFlyersError } = await supabase
        .from("flyer_jobs")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("updated_at", today.toISOString());
      
      if (completedFlyersError) throw completedFlyersError;
      
      const totalCompletedToday = (completedTodayBusinessCards?.length || 0) + (completedTodayFlyers?.length || 0);
      
      // Fetch batch type statistics
      const batchTypeStats = [
        { name: "Business Cards", progress: 0, total: 50 },
        { name: "Flyers A5", progress: 0, total: 50 },
        { name: "Flyers A6", progress: 0, total: 50 },
        { name: "Postcards", progress: 0, total: 50 }
      ];
      
      // For business cards, count queued jobs to determine "bucket fill"
      if (pendingBusinessCardJobs) {
        batchTypeStats[0].progress = pendingBusinessCardJobs.length;
      }
      
      // For flyers, count queued jobs to determine "bucket fill" based on size
      if (pendingFlyerJobs) {
        // Now pendingFlyerJobs has the size property, so we can safely filter by it
        const flyerA5Jobs = pendingFlyerJobs.filter(job => job.size === "A5");
        const flyerA6Jobs = pendingFlyerJobs.filter(job => job.size === "A6");
        batchTypeStats[1].progress = flyerA5Jobs?.length || 0;
        batchTypeStats[2].progress = flyerA6Jobs?.length || 0;
      }
      
      // Calculate buckets at capacity (if any batch type is at 80% or more)
      const bucketsFilled = batchTypeStats.filter(
        type => (type.progress / type.total) >= 0.8
      ).length;
      
      // Fetch recent activity from multiple job types
      const { data: recentBusinessCardJobs, error: recentBusinessCardError } = await supabase
        .from("business_card_jobs")
        .select("id, name, status, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(3);
      
      if (recentBusinessCardError) throw recentBusinessCardError;
      
      const { data: recentFlyerJobs, error: recentFlyerError } = await supabase
        .from("flyer_jobs")
        .select("id, name, status, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(3);
      
      if (recentFlyerError) throw recentFlyerError;
      
      // Transform job data to activity format and merge
      let recentActivity = [
        ...(recentBusinessCardJobs?.map(job => {
          let action = "Created";
          if (job.status === "batched") action = "Batched";
          if (job.status === "completed") action = "Completed";
          if (job.status === "cancelled") action = "Cancelled";
          
          return {
            id: job.id,
            type: 'job' as const,
            name: job.name || "Business Card Job",
            action,
            timestamp: job.updated_at
          };
        }) || []),
        ...(recentFlyerJobs?.map(job => {
          let action = "Created";
          if (job.status === "batched") action = "Batched";
          if (job.status === "completed") action = "Completed";
          if (job.status === "cancelled") action = "Cancelled";
          
          return {
            id: job.id,
            type: 'job' as const,
            name: job.name || "Flyer Job",
            action,
            timestamp: job.updated_at
          };
        }) || [])
      ];
      
      // Sort by timestamp (newest first)
      recentActivity.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      // Limit to 5 items
      recentActivity = recentActivity.slice(0, 5);
      
      setStats({
        activeBatches: activeBatches?.length || 0,
        pendingJobs: totalPendingJobs,
        printedToday: totalCompletedToday,
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
      
      toast({
        title: "Error loading dashboard",
        description: "Failed to load dashboard statistics. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
    } else {
      setStats(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  return {
    ...stats,
    refresh: fetchDashboardStats
  };
};
