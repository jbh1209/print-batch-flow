
import React, { useState } from "react";
import { EnhancedJobsTableWithBulkActions } from "@/components/tracker/jobs/EnhancedJobsTableWithBulkActions";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";
import { useUnifiedJobFiltering } from "@/hooks/tracker/useUnifiedJobFiltering";

const TrackerJobs = () => {
  const { jobs, isLoading } = useEnhancedProductionJobs();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Get user's accessible jobs using unified filtering
  const { filteredJobs } = useUnifiedJobFiltering({
    jobs,
    statusFilter
  });

  console.log("🔍 TrackerJobs - Unified Filtering Results:", {
    totalJobs: jobs.length,
    filteredJobs: filteredJobs.length,
    statusFilter
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Jobs Management</h1>
        <p className="text-gray-600">
          View and manage your accessible production jobs with enhanced workflow tracking
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Showing {filteredJobs.length} accessible jobs out of {jobs.length} total jobs
        </p>
      </div>

      <EnhancedJobsTableWithBulkActions statusFilter={statusFilter} />
    </div>
  );
};

export default TrackerJobs;
