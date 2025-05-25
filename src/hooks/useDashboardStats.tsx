
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useJobStats } from "./dashboard/useJobStats";
import { useBatchStats } from "./dashboard/useBatchStats";
import { useRecentActivity } from "./dashboard/useRecentActivity";

export const useDashboardStats = () => {
  const { user, isLoading: authLoading } = useAuth();
  const jobStats = useJobStats(user?.id);
  const batchStats = useBatchStats(user?.id);
  const activityStats = useRecentActivity(user?.id);

  useEffect(() => {
    // Only fetch data when user is available and auth is not loading
    if (user && !authLoading) {
      console.log("User authenticated, fetching dashboard stats for user:", user.id);
      jobStats.refresh();
      batchStats.refresh();
      activityStats.refresh();
    }
  }, [user, authLoading]);

  return {
    // Job stats
    pendingJobs: jobStats.pendingJobs,
    printedToday: jobStats.printedToday,
    
    // Batch stats
    activeBatches: batchStats.activeBatches,
    bucketsFilled: batchStats.bucketsFilled,
    batchTypeStats: batchStats.batchTypeStats,
    
    // Activity stats
    recentActivity: activityStats.recentActivity,
    
    // Loading and error states
    isLoading: authLoading || jobStats.isLoading || batchStats.isLoading || activityStats.isLoading,
    error: jobStats.error || batchStats.error || activityStats.error,
    
    // Refresh function
    refresh: () => {
      if (user && !authLoading) {
        jobStats.refresh();
        batchStats.refresh();
        activityStats.refresh();
      }
    }
  };
};
