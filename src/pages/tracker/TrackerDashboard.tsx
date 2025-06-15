import React from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { useProductionStages } from "@/hooks/tracker/useProductionStages";
import { TrackerOverviewStats } from "@/components/tracker/dashboard/TrackerOverviewStats";
import { TrackerStatusBreakdown } from "@/components/tracker/dashboard/TrackerStatusBreakdown";
import { TrackerQuickActions } from "@/components/tracker/dashboard/TrackerQuickActions";
import { TrackerEmptyState } from "@/components/tracker/dashboard/TrackerEmptyState";
import { RefreshIndicator } from "@/components/tracker/RefreshIndicator";
import { filterActiveJobs, filterCompletedJobs } from "@/utils/tracker/jobCompletionUtils";
import { useUnifiedProductionData } from "@/hooks/tracker/useUnifiedProductionData";

const TrackerDashboard = () => {
  // --- Use UNIFIED HOOK for production jobs and stages ---
  const {
    activeJobs,
    consolidatedStages,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    refreshJobs,
    getJobStats,
    getTimeSinceLastUpdate
  } = useUnifiedProductionData();

  // --- Now use new stats from unified data ---
  const stats = React.useMemo(
    () => getJobStats(activeJobs),
    [activeJobs, getJobStats]
  );

  console.log("TrackerDashboard render - isLoading:", isLoading, "active jobs count:", stats.total, "stages count:", consolidatedStages.length, "error:", error);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Error loading dashboard</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
            <RefreshIndicator
              lastUpdated={lastUpdated}
              isRefreshing={isRefreshing}
              onRefresh={refreshJobs}
              getTimeSinceLastUpdate={getTimeSinceLastUpdate}
            />
          </div>
        </div>
      </div>
    );
  }

  console.log("TrackerDashboard rendering main content with stats:", stats);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Production Tracker Dashboard</h1>
          <p className="text-gray-600">Monitor and manage your production workflow</p>
        </div>
        <RefreshIndicator
          lastUpdated={lastUpdated}
          isRefreshing={isRefreshing}
          onRefresh={refreshJobs}
          getTimeSinceLastUpdate={getTimeSinceLastUpdate}
        />
      </div>

      <TrackerOverviewStats stats={stats} />
      <TrackerStatusBreakdown stats={{
        ...stats,
        stages: consolidatedStages
      }} />
      <TrackerQuickActions />

      {stats.total === 0 && <TrackerEmptyState />}
    </div>
  );
};

export default TrackerDashboard;
