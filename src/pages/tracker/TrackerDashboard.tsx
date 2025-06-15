
import React from "react";
import { Loader2 } from "lucide-react";
import { useProductionJobs } from "@/hooks/useProductionJobs";
import { useProductionStages } from "@/hooks/tracker/useProductionStages";
import { TrackerOverviewStats } from "@/components/tracker/dashboard/TrackerOverviewStats";
import { TrackerStatusBreakdown } from "@/components/tracker/dashboard/TrackerStatusBreakdown";
import { TrackerQuickActions } from "@/components/tracker/dashboard/TrackerQuickActions";
import { TrackerEmptyState } from "@/components/tracker/dashboard/TrackerEmptyState";
import { RefreshIndicator } from "@/components/tracker/RefreshIndicator";

const TrackerDashboard = () => {
  // USER-SPECIFIC production jobs and all stages:
  const {
    jobs,
    isLoading,
    error,
    fetchJobs,
    getJobStats,
  } = useProductionJobs();
  const { stages, isLoading: isLoadingStages } = useProductionStages();

  // Track last fetch time for "last updated"
  const [lastFetched, setLastFetched] = React.useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // On mount, set initial lastFetched time
  React.useEffect(() => {
    if (!isLoading) setLastFetched(new Date());
  }, [isLoading]);

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchJobs();
    setLastFetched(new Date());
    setIsRefreshing(false);
  };

  // Simplified stages: { id, name, color }
  const simpleStages = React.useMemo(() => {
    return (stages || []).map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color || "#3B82F6",
    }));
  }, [stages]);

  // Compute all unique statuses in jobs data
  const uniqueStatuses = React.useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((job) => {
      if (job.status) set.add(job.status);
    });
    return Array.from(set);
  }, [jobs]);

  // Stats calculations
  const stats = React.useMemo(() => {
    const total = jobs.length;
    const inProgress = jobs.filter(
      (j) =>
        j.status &&
        ["Production", "In Progress", "Active", "Processing", "Started"].includes(
          j.status
        )
    ).length;
    const completed = jobs.filter(
      (j) =>
        (typeof j.status === "string" && j.status.toLowerCase() === "completed") ||
        j.status === "Completed"
    ).length;
    const prePress = jobs.filter(
      (j) =>
        (typeof j.status === "string" &&
          ["Pre-Press", "Pending", "DTP"].some(
            (t) => j.status.toLowerCase() === t.toLowerCase()
          ))
    ).length;

    // Cards per configured stages
    const statusCounts: Record<string, number> = {};

    // 1. Cards per stages: count jobs where status or category_name matches the stage name
    simpleStages.forEach((stage) => {
      statusCounts[stage.name] = jobs.filter(
        (j) =>
          j.status === stage.name ||
          j.category_name === stage.name || // fallback: could be used as a custom mapping
          j.category === stage.name // fallback for old data
      ).length;
    });

    // 2. Cards for all unique statuses (from data)
    uniqueStatuses.forEach((status) => {
      if (!(status in statusCounts)) {
        // Only add missing ones
        statusCounts[status] = jobs.filter((j) => j.status === status).length;
      }
    });

    // Special statuses
    statusCounts["Pre-Press"] = prePress;
    statusCounts["Completed"] = completed;

    return {
      total,
      inProgress,
      completed,
      prePress,
      statusCounts,
      stages: simpleStages,
    };
  }, [jobs, simpleStages, uniqueStatuses]);

  // Helper for last updated display
  const getTimeSinceLastUpdate = () => {
    if (!lastFetched) return null;
    const now = new Date();
    const diffMs = now.getTime() - lastFetched.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins === 1) return "1 minute ago";
    return `${diffMins} minutes ago`;
  };

  if (isLoading || isLoadingStages) {
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
