
import React from "react";

interface ProductionStatsProps {
  jobs: any[];
  jobsWithoutCategory: any[];
}

export const ProductionStats: React.FC<ProductionStatsProps> = ({
  jobs,
  jobsWithoutCategory
}) => {
  // Count jobs with active stages (jobs that have a workflow and current stage)
  const activeJobsCount = jobs.filter(job => 
    job.has_workflow && job.current_stage_id && job.workflow_status === 'active'
  ).length;

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
