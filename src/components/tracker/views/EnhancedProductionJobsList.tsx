
import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { useCustomWorkflowStatus } from "@/hooks/tracker/useCustomWorkflowStatus";
import { useJobRowColors } from "@/hooks/tracker/useJobRowColors";
import { BulkActionsBar } from "./components/BulkActionsBar";
import { JobRow } from "./components/JobRow";

interface EnhancedProductionJobsListProps {
  jobs: AccessibleJob[];
  onStartJob: (jobId: string, stageId: string) => Promise<boolean>;
  onCompleteJob: (jobId: string, stageId: string) => Promise<boolean>;
  onEditJob: (job: AccessibleJob) => void;
  onCategoryAssign: (job: AccessibleJob) => void;
  onCustomWorkflow: (job: AccessibleJob) => void;
  onDeleteJob: (jobId: string) => void;
  onBulkCategoryAssign: (selectedJobs: AccessibleJob[]) => void;
  onBulkStatusUpdate: (selectedJobs: AccessibleJob[], status: string) => void;
  onBulkDelete: (selectedJobs: AccessibleJob[]) => void;
  onGenerateBarcodes: (selectedJobs: AccessibleJob[]) => void;
  onBulkMarkCompleted?: (selectedJobs: AccessibleJob[]) => void;
  isAdmin?: boolean;
}

export const EnhancedProductionJobsList: React.FC<EnhancedProductionJobsListProps> = ({
  jobs,
  onStartJob,
  onCompleteJob,
  onEditJob,
  onCategoryAssign,
  onCustomWorkflow,
  onDeleteJob,
  onBulkCategoryAssign,
  onBulkStatusUpdate,
  onBulkDelete,
  onGenerateBarcodes,
  onBulkMarkCompleted,
  isAdmin = false
}) => {
  const [selectedJobs, setSelectedJobs] = useState<AccessibleJob[]>([]);

  // Get job IDs that might need custom workflow status check
  const jobIdsForCustomWorkflowCheck = useMemo(() => {
    return jobs
      .filter(job => !job.category_name || job.category_name === 'No Category')
      .map(job => job.job_id);
  }, [jobs]);

  // Use the custom hook to get real custom workflow status
  const { customWorkflowStatus } = useCustomWorkflowStatus(jobIdsForCustomWorkflowCheck);
  
  // Use the custom hook to get row colors
  const jobRowColors = useJobRowColors(jobs);

  const handleSelectJob = (job: AccessibleJob, checked: boolean) => {
    if (checked) {
      setSelectedJobs(prev => [...prev, job]);
    } else {
      setSelectedJobs(prev => prev.filter(j => j.job_id !== job.job_id));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobs(jobs);
    } else {
      setSelectedJobs([]);
    }
  };

  const clearSelection = () => {
    setSelectedJobs([]);
  };

  const isSelected = (job: AccessibleJob) => {
    return selectedJobs.some(j => j.job_id === job.job_id);
  };

  // Helper function to determine if job has custom workflow
  const hasCustomWorkflow = (job: AccessibleJob) => {
    // First check the hook's result for jobs without categories
    if (customWorkflowStatus[job.job_id] !== undefined) {
      return customWorkflowStatus[job.job_id];
    }
    // Fallback to the job's original property
    return job.has_custom_workflow;
  };

  return (
    <div className="space-y-4">
      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedJobs={selectedJobs}
        onBulkCategoryAssign={onBulkCategoryAssign}
        onBulkStatusUpdate={onBulkStatusUpdate}
        onBulkMarkCompleted={onBulkMarkCompleted}
        onCustomWorkflow={onCustomWorkflow}
        onGenerateBarcodes={onGenerateBarcodes}
        onBulkDelete={onBulkDelete}
        onClearSelection={clearSelection}
        isAdmin={isAdmin}
      />

      {/* Jobs List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Production Jobs Overview</CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedJobs.length === jobs.length && jobs.length > 0}
                onCheckedChange={handleSelectAll}
                disabled={jobs.length === 0}
              />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobRow
                key={job.job_id}
                job={job}
                isSelected={isSelected(job)}
                hasCustomWorkflow={hasCustomWorkflow(job)}
                rowColorClass={jobRowColors[job.job_id] || ''}
                onSelectJob={handleSelectJob}
                onStartJob={onStartJob}
                onCompleteJob={onCompleteJob}
                onEditJob={onEditJob}
                onCategoryAssign={onCategoryAssign}
                onCustomWorkflow={onCustomWorkflow}
                onDeleteJob={onDeleteJob}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
