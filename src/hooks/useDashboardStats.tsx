
import { useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useJobStats } from "./dashboard/useJobStats";
import { useBatchStats } from "./dashboard/useBatchStats";
import { useRecentActivity } from "./dashboard/useRecentActivity";

export const useDashboardStats = () => {
  const { user, isLoading: authLoading } = useAuth();
  const jobStats = useJobStats();
  const batchStats = useBatchStats();
  const activityStats = useRecentActivity(user?.id);

  // Simplified refresh function with error handling
  const refresh = useCallback(() => {
    try {
      console.log("Refreshing dashboard stats...");
      jobStats.refresh();
      batchStats.refresh();
      
      if (user?.id) {
        activityStats.refresh();
      }
    } catch (error) {
      console.warn("Dashboard refresh failed:", error);
    }
  }, [user?.id]);

  // Load stats when auth is complete - with delay to avoid auth conflicts
  useEffect(() => {
    if (!authLoading && user) {
      console.log("Auth complete, loading dashboard stats");
      
      // Add delay to ensure auth state is fully settled
      const timer = setTimeout(() => {
        try {
          jobStats.refresh();
          batchStats.refresh();
          
          if (user.id) {
            activityStats.refresh();
          }
        } catch (error) {
          console.warn("Dashboard stats loading failed:", error);
        }
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [authLoading, user?.id]);

  return {
    // Job stats (global)
    pendingJobs: jobStats.pendingJobs,
    printedToday: jobStats.printedToday,
    
    // Batch stats (global)
    activeBatches: batchStats.activeBatches,
    bucketsFilled: batchStats.bucketsFilled,
    batchTypeStats: batchStats.batchTypeStats,
    
    // Activity stats (user-specific)
    recentActivity: activityStats.recentActivity,
    
    // Loading and error states
    isLoading: authLoading || jobStats.isLoading || batchStats.isLoading,
    error: jobStats.error || batchStats.error || activityStats.error,
    
    // Simplified refresh function
    refresh
  };
};
