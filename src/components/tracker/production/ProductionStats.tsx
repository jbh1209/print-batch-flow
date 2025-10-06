
import React from "react";
import type { JobStageWithDetails } from "@/hooks/tracker/useRealTimeJobStages/types";

interface ProductionStatsProps {
  jobs: any[];
  jobStages: JobStageWithDetails[];
  jobsWithoutCategory: any[];
}

export const ProductionStats: React.FC<ProductionStatsProps> = ({
  jobs,
  jobStages,
  jobsWithoutCategory
}) => {
  // Count unique jobs with active stages
  const activeJobsCount = new Set(
    jobStages
      .filter(stage => stage.status === 'active')
      .map(stage => stage.job_id)
  ).size;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-lg border p-3">
        <div className="text-2xl font-bold text-blue-600">{jobs.length}</div>
        <div className="text-xs text-gray-600">Total Jobs</div>
      </div>
      <div className="bg-white rounded-lg border p-3">
        <div className="text-2xl font-bold text-green-600">
          {jobs.filter(j => j.has_workflow).length}
        </div>
        <div className="text-xs text-gray-600">With Workflow</div>
      </div>
      <div className="bg-white rounded-lg border p-3">
        <div className="text-2xl font-bold text-orange-600">
          {activeJobsCount}
        </div>
        <div className="text-xs text-gray-600">In Progress</div>
      </div>
      <div className="bg-white rounded-lg border p-3">
        <div className="text-2xl font-bold text-red-600">
          {jobsWithoutCategory.length}
        </div>
        <div className="text-xs text-gray-600">Need Category</div>
      </div>
    </div>
  );
};
