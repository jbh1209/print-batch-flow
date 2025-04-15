
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
      
      // Fetch pending jobs (jobs with status 'queued')
      const { data: pendingJobs, error: jobsError } = await supabase
        .from("business_card_jobs")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "queued");
      
      if (jobsError) throw jobsError;
      
      // Fetch jobs completed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: completedToday, error: completedError } = await supabase
        .from("business_card_jobs")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("updated_at", today.toISOString());
      
      if (completedError) throw completedError;
      
      // Fetch batch type statistics
      const batchTypeStats = [
        { name: "Business Cards", progress: 0, total: 50 },
        { name: "Flyers A5", progress: 0, total: 50 },
        { name: "Flyers A6", progress: 0, total: 50 },
        { name: "Postcards", progress: 0, total: 50 }
      ];
      
      // For business cards, count queued jobs to determine "bucket fill"
      const { data: businessCardJobs, error: businessCardError } = await supabase
        .from("business_card_jobs")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "queued");
      
      if (businessCardError) throw businessCardError;
      
      if (businessCardJobs) {
        batchTypeStats[0].progress = businessCardJobs.length;
      }
      
      // Calculate buckets at capacity (if any batch type is at 80% or more)
      const bucketsFilled = batchTypeStats.filter(
        type => (type.progress / type.total) >= 0.8
      ).length;
      
      // Fetch recent activity (simplified - in real app would include more info)
      const { data: recentJobs, error: recentError } = await supabase
        .from("business_card_jobs")
        .select("id, name, status, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(5);
      
      if (recentError) throw recentError;
      
      // Transform job data to activity format
      const recentActivity = recentJobs?.map(job => {
        let action = "Created";
        if (job.status === "batched") action = "Batched";
        if (job.status === "completed") action = "Completed";
        if (job.status === "cancelled") action = "Cancelled";
        
        return {
          id: job.id,
          type: 'job' as const,
          name: job.name,
          action,
          timestamp: job.updated_at
        };
      }) || [];
      
      setStats({
        activeBatches: activeBatches?.length || 0,
        pendingJobs: pendingJobs?.length || 0,
        printedToday: completedToday?.length || 0,
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
