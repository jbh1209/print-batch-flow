
import React from "react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { DtpWorkflowCard } from "@/components/tracker/factory/DtpWorkflowCard";
import { RefreshCw } from "lucide-react";

const TrackerDTPWorkflow = () => {
  const { jobs, isLoading, refreshJobs } = useAccessibleJobs({
    permissionType: 'work'
  });

  // Filter jobs that are in DTP or Proof stages
  const dtpJobs = jobs.filter(job => {
    const stageName = job.current_stage_name?.toLowerCase() || '';
    return stageName.includes('dtp') || stageName.includes('proof');
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">Loading DTP workflow...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold">DTP Workflow</h1>
        <p className="text-xs text-gray-600">Manage DTP and Proof processes</p>
      </div>

      {dtpJobs.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">No jobs in DTP or Proof stages</p>
          <p className="text-gray-400 text-xs">Jobs will appear here when they reach DTP or Proof stages</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {dtpJobs.map((job) => (
            <DtpWorkflowCard
              key={job.job_id}
              job={job}
              onRefresh={refreshJobs}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TrackerDTPWorkflow;
