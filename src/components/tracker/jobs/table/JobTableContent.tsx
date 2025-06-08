
import React from "react";
import { JobsTableContent } from "../JobsTableContent";

interface JobTableContentProps {
  jobs: any[];
  selectedJobs: string[];
  sortField: string;
  sortOrder: 'asc' | 'desc';
  onSelectJob: (jobId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onSort: (field: string) => void;
  onEditJob: (job: any) => void;
  onCategoryAssign: (job: any) => void;
  onDeleteSingleJob: (jobId: string) => void;
  onCustomWorkflow: (job: any) => void;
}

export const JobTableContent: React.FC<JobTableContentProps> = (props) => {
  return <JobsTableContent {...props} />;
};
