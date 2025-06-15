
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
    isRefreshing,
    error,
    lastUpdated,
    fetchJobs: refreshJobs,
    getJobStats,
  } = useProductionJobs();
  const { stages, isLoading: isLoadingStages } = useProductionStages();

  // Simplify stages to { id, name, color }
  const simpleStages = React.useMemo(() => {
    return (stages || []).map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color || "#3B82F6",
    }));
  }, [stages]);

  // Compute all statuses in use
  const uniqueStatuses = React.useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((job) => {
      if (job.status) set.add(job.status);
    });
    return Array.from(set);
  }, [jobs]);

  // Stats calculations
  const stats = React.useMemo(() => {
    // Main status numbers
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

    // Build combined counts for known stages & all actual statuses (for cards)
    const statusCounts: Record<string, number> = {};

    // 1. Cards per configured stages
    simpleStages.forEach((stage) => {
      // jobs that have 'current stage' matching stage.name
      statusCounts[stage.name] = jobs.filter(
        (j) =>
          j.status === stage.name ||
          j.current_stage_name === stage.name ||
          j.category === stage.name // fallback
      ).length;
    });

    // 2. Cards for ALL unique statuses (from jobs)
    uniqueStatuses.forEach((status) => {
      if (!(status in statusCounts)) {
        // Only add missing ones
        statusCounts[status] = jobs.filter((j) => j.status === status).length;
      }
    });

    // Make sure special statuses included too:
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
              lastUpdated={lastUpdated}
              isRefreshing={isRefreshing}
              onRefresh={refreshJobs}
              getTimeSinceLastUpdate={() => {
                if (!lastUpdated) return null;
                const now = new Date();
                const diffMs = now.getTime() - lastUpdated.getTime();
                const diffMins = Math.floor(diffMs / 60000);
                if (diffMins < 1) return "Just now";
                if (diffMins === 1) return "1 minute ago";
                return `${diffMins} minutes ago`;
              }}
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
          lastUpdated={lastUpdated}
          isRefreshing={isRefreshing}
          onRefresh={refreshJobs}
          getTimeSinceLastUpdate={() => {
            if (!lastUpdated) return null;
            const now = new Date();
            const diffMs = now.getTime() - lastUpdated.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            if (diffMins < 1) return "Just now";
            if (diffMins === 1) return "1 minute ago";
            return `${diffMins} minutes ago`;
          }}
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
