
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { castToUUID, safeDbMap, toSafeString } from "@/utils/database/dbHelpers";

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
        .eq("user_id", castToUUID(userId))
        .order("updated_at", { ascending: false })
        .limit(3);
      
      if (recentBusinessCardError) throw recentBusinessCardError;
      
      // Fetch recent flyer jobs
      const { data: recentFlyerJobs, error: recentFlyerError } = await supabase
        .from("flyer_jobs")
        .select("id, name, status, updated_at")
        .eq("user_id", castToUUID(userId))
        .order("updated_at", { ascending: false })
        .limit(3);
      
      if (recentFlyerError) throw recentFlyerError;
      
      // Transform and combine activity data using our safe mapping function
      const businessCardActivities = safeDbMap(recentBusinessCardJobs, job => ({
        id: toSafeString(job.id),
        type: 'job' as const,
        name: toSafeString(job.name) || "Business Card Job",
        action: toSafeString(job.status) === "batched" ? "Batched" :
               toSafeString(job.status) === "completed" ? "Completed" :
               toSafeString(job.status) === "cancelled" ? "Cancelled" : "Created",
        timestamp: toSafeString(job.updated_at)
      }));
      
      const flyerActivities = safeDbMap(recentFlyerJobs, job => ({
        id: toSafeString(job.id),
        type: 'job' as const,
        name: toSafeString(job.name) || "Flyer Job",
        action: toSafeString(job.status) === "batched" ? "Batched" :
               toSafeString(job.status) === "completed" ? "Completed" :
               toSafeString(job.status) === "cancelled" ? "Cancelled" : "Created",
        timestamp: toSafeString(job.updated_at)
      }));
      
      // Combine all activities
      let recentActivity = [
        ...businessCardActivities,
        ...flyerActivities
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
