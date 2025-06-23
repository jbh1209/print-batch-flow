
import React from "react";
import { Loader2 } from "lucide-react";
import { TrackerOverviewStats } from "@/components/tracker/dashboard/TrackerOverviewStats";
import { TrackerStatusBreakdown } from "@/components/tracker/dashboard/TrackerStatusBreakdown";
import { TrackerQuickActions } from "@/components/tracker/dashboard/TrackerQuickActions";
import { TrackerEmptyState } from "@/components/tracker/dashboard/TrackerEmptyState";
import { RefreshIndicator } from "@/components/tracker/RefreshIndicator";
import { useProductionJobs } from "@/hooks/useProductionJobs";

const TrackerDashboard = () => {
  // Use simple production jobs hook
  const { jobs, isLoading, error, fetchJobs: refresh, getJobStats } = useProductionJobs();
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(new Date());
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setLastUpdated(new Date());
    setIsRefreshing(false);
  };

  const getTimeSinceLastUpdate = () => {
    if (!lastUpdated) return '';
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
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

  // Calculate stats from jobs
  const jobStats = getJobStats();
  const stats = {
    total: jobStats.total,
    inProgress: jobStats.statusCounts['In Progress'] || 0,
    completed: jobStats.statusCounts['Completed'] || 0,
    pending: jobStats.statusCounts['Pending'] || 0,
    statusCounts: jobStats.statusCounts,
    stages: [],
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
