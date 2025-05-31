
import React from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";
import { TrackerOverviewStats } from "@/components/tracker/dashboard/TrackerOverviewStats";
import { TrackerStatusBreakdown } from "@/components/tracker/dashboard/TrackerStatusBreakdown";
import { TrackerQuickActions } from "@/components/tracker/dashboard/TrackerQuickActions";
import { TrackerEmptyState } from "@/components/tracker/dashboard/TrackerEmptyState";

const TrackerDashboard = () => {
  const { jobs, isLoading, error } = useEnhancedProductionJobs();
  
  // Calculate real-time stats from actual production jobs
  const getJobStats = () => {
    const statusCounts: Record<string, number> = {};
    
    // Initialize all statuses with 0
    const allStatuses = ["Pre-Press", "Printing", "Finishing", "Packaging", "Shipped", "Completed"];
    allStatuses.forEach(status => {
      statusCounts[status] = 0;
    });
    
    // Count actual jobs by status
    jobs.forEach(job => {
      const status = job.status || 'Pre-Press';
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status]++;
      } else {
        statusCounts[status] = 1;
      }
    });

    return {
      total: jobs.length,
      statusCounts
    };
  };

  const stats = getJobStats();

  console.log("TrackerDashboard render - isLoading:", isLoading, "jobs count:", jobs.length, "error:", error);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading dashboard...</span>
      </div>
    );
  }

  // Error state
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
