
import { useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useJobStats } from "./dashboard/useJobStats";
import { useBatchStats } from "./dashboard/useBatchStats";
import { useRecentActivity } from "./dashboard/useRecentActivity";

export const useDashboardStats = () => {
  const { user, isLoading: authLoading } = useAuth();
  const jobStats = useJobStats();
  const batchStats = useBatchStats();
  const activityStats = useRecentActivity(user?.id);
  
  const refreshTimeoutRef = useRef<NodeJS.Timeout>();
  const lastRefreshRef = useRef<number>(0);
  const MIN_REFRESH_INTERVAL = 5000; // Minimum 5 seconds between refreshes

  // Rate-limited refresh function
  const refresh = useCallback(() => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshRef.current;
    
    if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL) {
      console.log("Rate limiting dashboard refresh");
      return;
    }
    
    try {
      console.log("Refreshing dashboard stats...");
      lastRefreshRef.current = now;
      
      jobStats.refresh();
      batchStats.refresh();
      
      if (user?.id) {
        activityStats.refresh();
      }
    } catch (error) {
      console.warn("Dashboard refresh failed:", error);
    }
  }, [user?.id, jobStats, batchStats, activityStats]);

  // Load stats when auth is complete with debouncing
  useEffect(() => {
    if (!authLoading && user) {
      console.log("Auth complete, loading dashboard stats");
      
      // Clear any existing timeout
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      
      // Debounce the stats loading
      refreshTimeoutRef.current = setTimeout(() => {
        try {
          jobStats.refresh();
          batchStats.refresh();
          
          if (user.id) {
            activityStats.refresh();
          }
        } catch (error) {
          console.warn("Dashboard stats loading failed:", error);
        }
      }, 300);

      return () => {
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }
      };
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
    
    // Rate-limited refresh function
    refresh
  };
};
