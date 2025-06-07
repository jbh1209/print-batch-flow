
import React from "react";
import { SimpleJobsView } from "@/components/tracker/common/SimpleJobsView";
import { TrackerErrorBoundary } from "@/components/tracker/error-boundaries/TrackerErrorBoundary";

const TrackerDashboard = () => {
  return (
    <div className="h-full flex flex-col p-6">
      <TrackerErrorBoundary componentName="Dashboard">
        <div className="space-y-6">
          {/* Welcome Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">Production Tracker</h1>
            <p className="text-gray-600 mt-2">Welcome to your simplified production dashboard</p>
          </div>

          {/* Active Jobs Overview */}
          <SimpleJobsView
            statusFilter="Pre-Press"
            title="Active Jobs"
            subtitle="Jobs currently in progress"
            groupByStage={true}
          />
        </div>
      </TrackerErrorBoundary>
    </div>
  );
};

export default TrackerDashboard;
