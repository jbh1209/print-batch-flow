
import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import JobStatusBadge from "@/components/JobStatusBadge";
import JobActions from "./JobActions";
import EmptyState from "./EmptyState";

export type JobStatus = "queued" | "batched" | "completed" | "cancelled";
export type LaminationType = "gloss" | "matt" | "soft_touch" | "none";

export interface Job {
  id: string;
  name: string;
  file_name: string;
  quantity: number;
  lamination_type: LaminationType;
  due_date: string;
  uploaded_at: string;
  status: JobStatus;
  pdf_url: string;
  double_sided?: boolean;
}

interface JobsTableProps {
  jobs: Job[];
  isLoading: boolean;
  onRefresh: () => void;
  selectedJobs: string[];
  onSelectJob: (jobId: string, isSelected: boolean) => void;
  onSelectAllJobs: (isSelected: boolean) => void;
  error?: string | null;
}

const JobsTable = ({ 
  jobs, 
  isLoading, 
  onRefresh,
  selectedJobs,
  onSelectJob,
  onSelectAllJobs,
  error
}: JobsTableProps) => {
  const [selectAll, setSelectAll] = useState(false);

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    onSelectAllJobs(checked);
  };

  const isJobSelectable = (job: Job) => {
    // Only queued jobs can be selected for batching
    return job.status === "queued";
  };

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={9} className="h-24">
          <EmptyState type="loading" entityName="jobs" />
        </TableCell>
      </TableRow>
    );
  }

  if (error) {
    return (
      <TableRow>
        <TableCell colSpan={9} className="h-64">
          <EmptyState 
            type="error" 
            entityName="jobs" 
            errorMessage={error}
            onRetry={onRefresh} 
          />
        </TableCell>
      </TableRow>
    );
  }

  if (jobs.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={9} className="h-64">
          <EmptyState 
            type="empty" 
            entityName="jobs"
            createPath="/batches/business-cards/jobs/new"
          />
        </TableCell>
      </TableRow>
    );
  }

  // Count selectable jobs
  const selectableJobsCount = jobs.filter(isJobSelectable).length;

  return (
    <>
      <TableRow className="bg-muted/50">
        <TableCell>
          <Checkbox 
            checked={selectAll && selectableJobsCount > 0} 
            onCheckedChange={handleSelectAll}
            disabled={selectableJobsCount === 0}
          />
        </TableCell>
        <TableCell colSpan={8} className="text-xs text-muted-foreground">
          {selectableJobsCount === 0 ? (
            "No jobs available for batching"
          ) : (
            `${selectedJobs.length} of ${selectableJobsCount} jobs selected`
          )}
        </TableCell>
      </TableRow>
      
      {jobs.map((job) => {
        const isSelected = selectedJobs.includes(job.id);
        const canSelect = isJobSelectable(job);
        
        return (
          <TableRow key={job.id} className={isSelected ? "bg-primary/5" : undefined}>
            <TableCell>
              <Checkbox 
                checked={isSelected} 
                onCheckedChange={(checked) => onSelectJob(job.id, checked === true)}
                disabled={!canSelect}
              />
            </TableCell>
            <TableCell>{job.name}</TableCell>
            <TableCell>
              <span 
                className="text-blue-600 hover:underline cursor-pointer" 
                onClick={() => {
                  if (job.pdf_url) {
                    window.open(job.pdf_url, '_blank');
                  }
                }}
              >
                {job.file_name}
              </span>
            </TableCell>
            <TableCell>{job.quantity}</TableCell>
            <TableCell>
              {job.lamination_type === 'none' ? 'None' : 
              job.lamination_type.charAt(0).toUpperCase() + job.lamination_type.slice(1)}
            </TableCell>
            <TableCell>{formatDate(job.due_date)}</TableCell>
            <TableCell>{formatDate(job.uploaded_at)}</TableCell>
            <TableCell><JobStatusBadge status={job.status} /></TableCell>
            <TableCell className="text-right">
              <JobActions 
                jobId={job.id} 
                pdfUrl={job.pdf_url} 
                onJobDeleted={onRefresh}
              />
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
};

export default JobsTable;
