
import React, { useEffect } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { useProductionJobs } from "@/hooks/useProductionJobs";
import { TrackerOverviewStats } from "@/components/tracker/dashboard/TrackerOverviewStats";
import { TrackerStatusBreakdown } from "@/components/tracker/dashboard/TrackerStatusBreakdown";
import { TrackerQuickActions } from "@/components/tracker/dashboard/TrackerQuickActions";
import { TrackerEmptyState } from "@/components/tracker/dashboard/TrackerEmptyState";

const TrackerDashboard = () => {
  const { jobs, isLoading, error, getJobStats } = useProductionJobs();
  const stats = getJobStats();

  console.log("TrackerDashboard render - isLoading:", isLoading, "jobs count:", jobs.length, "error:", error);

  // Add debugging effect
  useEffect(() => {
    console.log("TrackerDashboard mounted/updated:", {
      isLoading,
      jobsCount: jobs.length,
      error,
      stats
    });
  }, [isLoading, jobs.length, error, stats]);

  // Loading state with timeout protection
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading dashboard...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <div>
              <p className="font-medium">Error loading dashboard</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  console.log("TrackerDashboard rendering main content with stats:", stats);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Production Tracker Dashboard</h1>
        <p className="text-gray-600">Monitor and manage your production workflow</p>
      </div>

      <TrackerOverviewStats stats={stats} />
      <TrackerStatusBreakdown stats={stats} />
      <TrackerQuickActions />

      {stats.total === 0 && <TrackerEmptyState />}
    </div>
  );
};

export default TrackerDashboard;
