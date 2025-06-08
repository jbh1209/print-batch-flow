
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
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin mr-2" />
        <span>Loading DTP workflow...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">DTP Workflow</h1>
        <p className="text-gray-600">Manage DTP and Proof processes</p>
      </div>

      {dtpJobs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No jobs in DTP or Proof stages</p>
          <p className="text-gray-400">Jobs will appear here when they reach DTP or Proof stages</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
