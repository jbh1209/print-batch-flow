
import React from "react";
import { Loader2 } from "lucide-react";
import { useUnifiedProductionData } from "@/hooks/tracker/useUnifiedProductionData";
import { TrackerOverviewStats } from "@/components/tracker/dashboard/TrackerOverviewStats";
import { TrackerStatusBreakdown } from "@/components/tracker/dashboard/TrackerStatusBreakdown";
import { TrackerQuickActions } from "@/components/tracker/dashboard/TrackerQuickActions";
import { TrackerEmptyState } from "@/components/tracker/dashboard/TrackerEmptyState";
import { RefreshIndicator } from "@/components/tracker/RefreshIndicator";

// --- Dashboard using Unified Production Data ---
const TrackerDashboard = () => {
  const {
    activeJobs,
    consolidatedStages,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    refreshJobs,
    getTimeSinceLastUpdate,
  } = useUnifiedProductionData();

  // Simplify stages: only those with id, name, color
  const simpleStageArr = React.useMemo(() => {
    return (consolidatedStages || [])
      .map((stage: any) => ({
        id: stage.id,
        name: stage.name,
        color: stage.color || "#3B82F6",
      }))
      .filter(stage => !!stage.id && !!stage.name);
  }, [consolidatedStages]);

  // Calculate stats in the format that OverviewStats/StatusBreakdown expect
  const stats = React.useMemo(() => {
    // In-progress = jobs is_active
    const inProgress = activeJobs.filter(j => j.is_active).length;
    // Pre-press = jobs whose status (normalized) is Pre-Press (or in pending/dtp)
    const prePress = activeJobs.filter(j =>
      (typeof j.status === "string" && j.status.toLowerCase() === "pre-press") ||
      (typeof j.current_stage_name === "string" && j.current_stage_name.toLowerCase() === "pre-press")
    ).length;
    // Completed: status string matches completed or is_completed flag
    const completed = activeJobs.filter(j =>
      (typeof j.status === "string" && j.status.toLowerCase() === "completed") ||
      j.is_completed
    ).length;
    // Status/stage counts: count by current_stage_name, fallback to status
    const statusCounts: Record<string, number> = {};
    simpleStageArr.forEach(stage => {
      statusCounts[stage.name] = 0;
    });
    statusCounts["Pre-Press"] = 0;
    statusCounts["Completed"] = completed;

    activeJobs.forEach(job => {
      // Use display_stage_name > current_stage_name > status
      const stageName = job.display_stage_name || job.current_stage_name || job.status || "Unknown";
      statusCounts[stageName] = (statusCounts[stageName] || 0) + 1;
    });

    return {
      total: activeJobs.length,
      inProgress,
      completed,
      prePress,
      statusCounts,
      stages: simpleStageArr,
    };
  }, [activeJobs, simpleStageArr]);

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
      <TrackerStatusBreakdown stats={stats} />
      <TrackerQuickActions />
      {stats.total === 0 && <TrackerEmptyState />}
    </div>
  );
};

export default TrackerDashboard;
