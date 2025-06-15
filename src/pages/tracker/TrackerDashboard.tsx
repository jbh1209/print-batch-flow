import React from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { useProductionStages } from "@/hooks/tracker/useProductionStages";
import { TrackerOverviewStats } from "@/components/tracker/dashboard/TrackerOverviewStats";
import { TrackerStatusBreakdown } from "@/components/tracker/dashboard/TrackerStatusBreakdown";
import { TrackerQuickActions } from "@/components/tracker/dashboard/TrackerQuickActions";
import { TrackerEmptyState } from "@/components/tracker/dashboard/TrackerEmptyState";
import { RefreshIndicator } from "@/components/tracker/RefreshIndicator";
import { filterActiveJobs, filterCompletedJobs } from "@/utils/tracker/jobCompletionUtils";
import { useDataManager } from "@/hooks/tracker/useDataManager";

const TrackerDashboard = () => {
  // --- Confirmed: useDataManager provides full jobs, with correct caching per route now ---
  const { 
    jobs, 
    isLoading: jobsLoading, 
    isRefreshing,
    lastUpdated,
    error: jobsError,
    manualRefresh,
    getTimeSinceLastUpdate
  } = useDataManager();
  const { stages, isLoading: stagesLoading } = useProductionStages();
  const isLoading = jobsLoading || stagesLoading;
  const error = jobsError;

  // --- PATCH: Compute job stats only from jobs array, don't double-filter ---
  const getJobStats = () => {
    if (!jobs || !Array.isArray(jobs)) {
      return { total: 0, inProgress: 0, completed: 0, prePress: 0, statusCounts: {}, stages: [] };
    }
    // Filter functions
    const activeJobs = jobs.filter(j => String(j.status || '').toLowerCase() !== "completed" && String(j.status || '').toLowerCase() !== "shipped");
    const completedJobs = jobs.filter(j => String(j.status || '').toLowerCase() === "completed" || String(j.status || '').toLowerCase() === "shipped");
    const statusCounts: Record<string, number> = {};

    // Initialize all actual stages with 0
    stages.forEach(stage => {
      statusCounts[stage.name] = 0;
    });

    // Fallbacks
    statusCounts["Pre-Press"] = 0;
    statusCounts["Completed"] = completedJobs.length;

    // Count ONLY ACTIVE jobs by their current stage/status
    activeJobs.forEach(job => {
      if (job.current_stage) {
        if (statusCounts.hasOwnProperty(job.current_stage)) {
          statusCounts[job.current_stage]++;
        } else {
          statusCounts[job.current_stage] = 1;
        }
      } else {
        const status = job.status || 'Pre-Press';
        if (statusCounts.hasOwnProperty(status)) {
          statusCounts[status]++;
        } else {
          statusCounts[status] = 1;
        }
      }
    });

    // Calculate summary stats from ACTIVE jobs only
    const inProgressStages = stages.filter(stage =>
      !['Pre-Press', 'Completed', 'Shipped'].includes(stage.name)
    );
    const inProgressCount = inProgressStages.reduce((total, stage) =>
      total + (statusCounts[stage.name] || 0), 0);
    const prePressCount = statusCounts["Pre-Press"] || 0;

    return {
      total: activeJobs.length,
      inProgress: inProgressCount,
      completed: completedJobs.length,
      prePress: prePressCount,
      statusCounts,
      stages
    };
  };

  const stats = getJobStats();

  console.log("TrackerDashboard render - isLoading:", isLoading, "active jobs count:", stats.total, "completed jobs:", stats.completed, "stages count:", stages.length, "error:", error);

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
              onRefresh={manualRefresh}
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
          onRefresh={manualRefresh}
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
