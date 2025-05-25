
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

  // Memoized refresh function to prevent infinite loops
  const refresh = useCallback(() => {
    console.log("Refreshing dashboard stats...");
    jobStats.refresh();
    batchStats.refresh();
    
    if (user && !authLoading) {
      console.log("User authenticated, refreshing activity for user:", user.id);
      activityStats.refresh();
    }
  }, [user?.id, authLoading]); // Only depend on stable values

  // Load stats once on mount and when user changes
  useEffect(() => {
    console.log("Dashboard stats effect triggered - user:", user?.id, "authLoading:", authLoading);
    
    // Always fetch global stats
    jobStats.refresh();
    batchStats.refresh();
    
    // Only fetch user-specific activity if user is available
    if (user && !authLoading) {
      console.log("User authenticated, fetching activity for user:", user.id);
      activityStats.refresh();
    }
  }, [user?.id, authLoading]); // Only depend on user ID and auth loading state

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
    
    // Memoized refresh function
    refresh
  };
};
