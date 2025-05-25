
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useJobStats } from "./dashboard/useJobStats";
import { useBatchStats } from "./dashboard/useBatchStats";
import { useRecentActivity } from "./dashboard/useRecentActivity";

export const useDashboardStats = () => {
  const { user, isLoading: authLoading } = useAuth();
  const jobStats = useJobStats();
  const batchStats = useBatchStats();
  const activityStats = useRecentActivity(user?.id);

  useEffect(() => {
    // Fetch stats immediately, regardless of auth state for global metrics
    console.log("Fetching dashboard stats...");
    jobStats.refresh();
    batchStats.refresh();
    
    // Only fetch activity if user is available (user-specific)
    if (user && !authLoading) {
      console.log("User authenticated, fetching activity for user:", user.id);
      activityStats.refresh();
    }
  }, [user, authLoading]);

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
    isLoading: jobStats.isLoading || batchStats.isLoading || (authLoading && !user),
    error: jobStats.error || batchStats.error || activityStats.error,
    
    // Refresh function
    refresh: () => {
      jobStats.refresh();
      batchStats.refresh();
      if (user && !authLoading) {
        activityStats.refresh();
      }
    }
  };
};
