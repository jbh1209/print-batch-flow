import React from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";
import { useProductionStages } from "@/hooks/tracker/useProductionStages";
import { TrackerOverviewStats } from "@/components/tracker/dashboard/TrackerOverviewStats";
import { TrackerStatusBreakdown } from "@/components/tracker/dashboard/TrackerStatusBreakdown";
import { TrackerQuickActions } from "@/components/tracker/dashboard/TrackerQuickActions";
import { TrackerEmptyState } from "@/components/tracker/dashboard/TrackerEmptyState";
import { getJobCounts, isJobCompleted } from "@/utils/tracker/jobCompletionUtils";

const TrackerDashboard = () => {
  const { jobs, isLoading: jobsLoading, error: jobsError } = useEnhancedProductionJobs();
  const { stages, isLoading: stagesLoading } = useProductionStages();
  
  const isLoading = jobsLoading || stagesLoading;
  const error = jobsError;
  
  // Calculate real-time stats from actual production jobs and stages using unified logic
  const getJobStats = () => {
    const { activeJobs, completedJobs } = getJobCounts(jobs);
    const statusCounts: Record<string, number> = {};
    
    // Initialize all actual stages with 0
    stages.forEach(stage => {
      statusCounts[stage.name] = 0;
    });
    
    // Add fallback for jobs without workflow stages
    statusCounts["Pre-Press"] = 0;
    statusCounts["Completed"] = completedJobs.length;
    
    // Count ONLY ACTIVE jobs by their current stage or default status
    activeJobs.forEach(job => {
      if (job.current_stage) {
        // Job has workflow - use current stage
        if (statusCounts.hasOwnProperty(job.current_stage)) {
          statusCounts[job.current_stage]++;
        } else {
          statusCounts[job.current_stage] = 1;
        }
      } else {
        // Job doesn't have workflow - use status or default to Pre-Press
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
    
    const inProgressCount = inProgressStages.reduce((total, stage) => {
      return total + (statusCounts[stage.name] || 0);
    }, 0);

    const prePressCount = statusCounts["Pre-Press"] || 0;

    return {
      total: activeJobs.length, // Only count active jobs
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
