
import React from "react";
import { Loader2 } from "lucide-react";
import { TrackerOverviewStats } from "@/components/tracker/dashboard/TrackerOverviewStats";
import { TrackerStatusBreakdown } from "@/components/tracker/dashboard/TrackerStatusBreakdown";
import { TrackerQuickActions } from "@/components/tracker/dashboard/TrackerQuickActions";
import { TrackerEmptyState } from "@/components/tracker/dashboard/TrackerEmptyState";
import { RefreshIndicator } from "@/components/tracker/RefreshIndicator";
import { useProductionDataContext } from "@/contexts/ProductionDataContext";

const TrackerDashboard = () => {
  // Use cached production data instead of separate API calls
  const {
    jobs,
    activeJobs,
    isLoading,
    error,
    lastUpdated,
    refresh,
    getTimeSinceLastUpdate
  } = useProductionDataContext();

  // Local refresh UI state
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
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
              lastUpdated={lastUpdated}
              isRefreshing={isRefreshing}
              onRefresh={handleRefresh}
              getTimeSinceLastUpdate={getTimeSinceLastUpdate}
            />
          </div>
        </div>
      </div>
    );
  }

  // Calculate stats from cached production data
  const total = jobs.length;
  const inProgress = activeJobs.filter(job => job.is_active).length;
  const completed = jobs.filter(job => job.is_completed).length;
  const pending = activeJobs.filter(job => job.is_pending).length;

  // Build status counts from actual job data
  const statusCounts: Record<string, number> = {};
  jobs.forEach(job => {
    const status = job.status || 'Unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  // Get unique stages from jobs
  const stages = Array.from(new Set(
    jobs.flatMap(job => job.stages?.map(stage => stage.stage_name) || [])
  )).map(stageName => ({ name: stageName }));

  const stats = {
    total,
    inProgress,
    completed,
    pending,
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
          lastUpdated={lastUpdated}
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
