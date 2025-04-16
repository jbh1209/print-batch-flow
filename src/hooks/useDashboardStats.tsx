
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useJobStats } from "./dashboard/useJobStats";
import { useBatchStats } from "./dashboard/useBatchStats";
import { useRecentActivity } from "./dashboard/useRecentActivity";

export const useDashboardStats = () => {
  const { user } = useAuth();
  const jobStats = useJobStats(user?.id);
  const batchStats = useBatchStats(user?.id);
  const activityStats = useRecentActivity(user?.id);

  useEffect(() => {
    if (user) {
      jobStats.refresh();
      batchStats.refresh();
      activityStats.refresh();
    }
  }, [user]);

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
    isLoading: jobStats.isLoading || batchStats.isLoading || activityStats.isLoading,
    error: jobStats.error || batchStats.error || activityStats.error,
    
    // Refresh function
    refresh: () => {
      jobStats.refresh();
      batchStats.refresh();
      activityStats.refresh();
    }
  };
};
