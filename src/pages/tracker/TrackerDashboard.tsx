import React from "react";
import { Loader2 } from "lucide-react";
import { useProductionJobs } from "@/hooks/useProductionJobs";
import { useProductionStages } from "@/hooks/tracker/useProductionStages";
import { TrackerOverviewStats } from "@/components/tracker/dashboard/TrackerOverviewStats";
import { TrackerStatusBreakdown } from "@/components/tracker/dashboard/TrackerStatusBreakdown";
import { TrackerQuickActions } from "@/components/tracker/dashboard/TrackerQuickActions";
import { TrackerEmptyState } from "@/components/tracker/dashboard/TrackerEmptyState";
import { RefreshIndicator } from "@/components/tracker/RefreshIndicator";
import { useWorkflowJobStats } from "@/hooks/tracker/useWorkflowJobStats";

const TrackerDashboard = () => {
  // Use new workflow stats
  const {
    total,
    inProgress,
    completed,
    prePress,
    statusCounts,
    stages,
    isLoading,
    error,
    refresh,
  } = useWorkflowJobStats();

  // Local refresh UI state
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [lastFetched, setLastFetched] = React.useState<Date | null>(null);

  React.useEffect(() => {
    if (!isLoading) setLastFetched(new Date());
  }, [isLoading]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setLastFetched(new Date());
    setIsRefreshing(false);
  };

  const getTimeSinceLastUpdate = () => {
    if (!lastFetched) return null;
    const now = new Date();
    const diffMs = now.getTime() - lastFetched.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins === 1) return "1 minute ago";
    return `${diffMins} minutes ago`;
  };

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
              lastUpdated={lastFetched}
              isRefreshing={isRefreshing}
              onRefresh={handleRefresh}
              getTimeSinceLastUpdate={getTimeSinceLastUpdate}
            />
          </div>
        </div>
      </div>
    );
  }

  // Build stats shape for cards
  const stats = {
    total,
    inProgress,
    completed,
    prePress,
    statusCounts,
    stages,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Production Tracker Dashboard</h1>
          <p className="text-gray-600">Monitor and manage your production workflow</p>
        </div>
        <RefreshIndicator
          lastUpdated={lastFetched}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
          getTimeSinceLastUpdate={getTimeSinceLastUpdate}
        />
      </div>
      <TrackerOverviewStats stats={stats} />
      <TrackerStatusBreakdown stats={stats} />
      <TrackerQuickActions />
      {stats.total === 0 && <TrackerEmptyState />}
    </div>
  );
};

export default TrackerDashboard;
