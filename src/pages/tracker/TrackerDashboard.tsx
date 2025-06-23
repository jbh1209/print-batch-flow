
import React from "react";
import { Loader2 } from "lucide-react";
import { TrackerOverviewStats } from "@/components/tracker/dashboard/TrackerOverviewStats";
import { TrackerStatusBreakdown } from "@/components/tracker/dashboard/TrackerStatusBreakdown";
import { TrackerQuickActions } from "@/components/tracker/dashboard/TrackerQuickActions";
import { TrackerEmptyState } from "@/components/tracker/dashboard/TrackerEmptyState";
import { RefreshIndicator } from "@/components/tracker/RefreshIndicator";
import { useProductionJobs } from "@/hooks/useProductionJobs";
import { useRealTimeJobStages } from "@/hooks/tracker/useRealTimeJobStages";

const TrackerDashboard = () => {
  // Use the same data fetching pattern as other working components
  const {
    jobs,
    isLoading: jobsLoading,
    error: jobsError,
    fetchJobs
  } = useProductionJobs();

  const {
    jobStages,
    isLoading: stagesLoading,
    lastUpdate,
    refreshStages
  } = useRealTimeJobStages(jobs);

  const isLoading = jobsLoading || stagesLoading;
  const error = jobsError;

  // Local refresh UI state
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchJobs(), refreshStages()]);
    setIsRefreshing(false);
  };

  const getTimeSinceLastUpdate = () => {
    if (!lastUpdate) return null;
    const now = new Date();
    const ms = now.getTime() - lastUpdate.getTime();
    const mins = Math.floor(ms / (1000 * 60));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
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
              lastUpdated={lastUpdate}
              isRefreshing={isRefreshing}
              onRefresh={handleRefresh}
              getTimeSinceLastUpdate={getTimeSinceLastUpdate}
            />
          </div>
        </div>
      </div>
    );
  }

  // Calculate stats from production data
  const activeJobs = jobs.filter(job => job.status !== 'Completed');
  const total = jobs.length;
  const inProgress = jobStages.filter(stage => stage.status === 'active').length;
  const completed = jobs.filter(job => job.status === 'Completed').length;
  const pending = jobStages.filter(stage => stage.status === 'pending').length;

  // Build status counts from actual job data
  const statusCounts: Record<string, number> = {};
  jobs.forEach(job => {
    const status = job.status || 'Unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  // Get unique stages from jobStages
  const stages = jobStages.reduce((acc, stage) => {
    const existing = acc.find(s => s.id === stage.production_stage_id);
    if (!existing && stage.production_stage) {
      acc.push({
        id: stage.production_stage_id,
        name: stage.production_stage.name,
        color: stage.production_stage.color
      });
    }
    return acc;
  }, [] as any[]);

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
          lastUpdated={lastUpdate}
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
