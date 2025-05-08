
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RecentActivity {
  id: string;
  type: 'job' | 'batch';
  name: string;
  action: string;
  timestamp: string;
}

interface ActivityStats {
  recentActivity: RecentActivity[];
  isLoading: boolean;
  error: string | null;
}

export const useRecentActivity = (userId: string | undefined) => {
  const { toast } = useToast();
  const [stats, setStats] = useState<ActivityStats>({
    recentActivity: [],
    isLoading: true,
    error: null
  });

  const fetchRecentActivity = async () => {
    if (!userId) return;
    
    try {
      setStats(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Fetch recent business card jobs
      const { data: recentBusinessCardJobs, error: recentBusinessCardError } = await supabase
        .from("business_card_jobs")
        .select("id, name, status, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(3);
      
      if (recentBusinessCardError) throw recentBusinessCardError;
      
      // Fetch recent flyer jobs
      const { data: recentFlyerJobs, error: recentFlyerError } = await supabase
        .from("flyer_jobs")
        .select("id, name, status, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(3);
      
      if (recentFlyerError) throw recentFlyerError;
      
      // Transform and combine activity data
      let recentActivity = [
        ...(recentBusinessCardJobs?.map(job => ({
          id: job.id,
          type: 'job' as const,
          name: job.name || "Business Card Job",
          action: job.status === "batched" ? "Batched" :
                 job.status === "completed" ? "Completed" :
                 job.status === "cancelled" ? "Cancelled" : "Created",
          timestamp: job.updated_at
        })) || []),
        ...(recentFlyerJobs?.map(job => ({
          id: job.id,
          type: 'job' as const,
          name: job.name || "Flyer Job",
          action: job.status === "batched" ? "Batched" :
                 job.status === "completed" ? "Completed" :
                 job.status === "cancelled" ? "Cancelled" : "Created",
          timestamp: job.updated_at
        })) || [])
      ];
      
      // Sort by timestamp and limit to 5 items
      recentActivity.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      recentActivity = recentActivity.slice(0, 5);
      
      setStats({
        recentActivity,
        isLoading: false,
        error: null
      });
      
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      setStats(prev => ({
        ...prev,
        isLoading: false,
        error: "Failed to load recent activity"
      }));
      
      toast({
        title: "Error loading recent activity",
        description: "Failed to load recent activity. Please try again.",
        variant: "destructive",
      });
    }
  };

  return {
    ...stats,
    refresh: fetchRecentActivity
  };
};
