
import React, { useState } from "react";
import { EnhancedJobsTableWithBulkActions } from "@/components/tracker/jobs/EnhancedJobsTableWithBulkActions";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";

const TrackerJobs = () => {
  const { jobs, isLoading } = useEnhancedProductionJobs();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Jobs Management</h1>
        <p className="text-gray-600">
          View and manage all production jobs with enhanced workflow tracking
        </p>
      </div>

      <EnhancedJobsTableWithBulkActions statusFilter={statusFilter} />
    </div>
  );
};

export default TrackerJobs;
