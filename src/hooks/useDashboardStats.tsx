
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

  // Simplified refresh function
  const refresh = useCallback(() => {
    console.log("Refreshing dashboard stats...");
    jobStats.refresh();
    batchStats.refresh();
    
    if (user?.id) {
      activityStats.refresh();
    }
  }, [user?.id]);

  // Only load stats when auth is complete and user is available
  useEffect(() => {
    if (!authLoading) {
      console.log("Auth complete, loading dashboard stats");
      jobStats.refresh();
      batchStats.refresh();
      
      if (user?.id) {
        activityStats.refresh();
      }
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
