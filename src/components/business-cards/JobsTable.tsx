import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { TableRow, TableCell } from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import DueDateIndicator from "./DueDateIndicator";
import JobActions from "./JobActions";

// Make JobStatus more flexible to handle database string values
export type JobStatus = "queued" | "batched" | "completed" | "cancelled" | string;

export type LaminationType = "gloss" | "matt" | "soft_touch" | "none";

export interface Job {
  id: string;
  name: string;
  file_name: string;
  quantity: number;
  lamination_type: LaminationType;
  due_date: string;
  uploaded_at: string;
  status: JobStatus; // Now accepts any string
  pdf_url: string;
  double_sided?: boolean;
  job_number?: string;
  updated_at?: string;
  user_id?: string;
  paper_type?: string;
}

interface JobsTableProps {
  jobs: Job[];
  selectedJobs: string[];
  onJobSelect: (jobId: string, isSelected: boolean) => void;
  onSelectAll: (isSelected: boolean) => void;
  onDeleteJob: (jobId: string) => Promise<void>;
  isLoading?: boolean;
}

const JobsTable: React.FC<JobsTableProps> = ({
  jobs,
  selectedJobs,
  onJobSelect,
  onSelectAll,
  onDeleteJob,
  isLoading = false
}) => {
  const getStatusBadge = (status: JobStatus) => {
    const statusColors = {
      queued: "bg-yellow-100 text-yellow-800",
      batched: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800"
    };

    const color = statusColors[status as keyof typeof statusColors] || "bg-gray-100 text-gray-800";
    
    return (
      <Badge variant="outline" className={color}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (jobs.length === 0 && !isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={9} className="p-8 text-center text-muted-foreground">
          No business card jobs found.
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {jobs.map((job) => (
        <TableRow key={job.id} className="hover:bg-muted/50">
          <TableCell className="w-10">
            <Checkbox
              checked={selectedJobs.includes(job.id)}
              onCheckedChange={(checked) => onJobSelect(job.id, !!checked)}
              aria-label={`Select ${job.name}`}
            />
          </TableCell>
          <TableCell>
            <div>
              <p className="font-medium">{job.name}</p>
              {job.job_number && (
                <p className="text-xs text-muted-foreground">#{job.job_number}</p>
              )}
            </div>
          </TableCell>
          <TableCell>
            <p className="text-sm text-muted-foreground truncate max-w-32">{job.file_name}</p>
          </TableCell>
          <TableCell>
            {job.quantity.toLocaleString()}
          </TableCell>
          <TableCell>
            <div className="text-sm">
              <p>{job.lamination_type}</p>
              {job.double_sided && (
                <Badge variant="secondary" className="text-xs mt-1">Double-sided</Badge>
              )}
            </div>
          </TableCell>
          <TableCell>
            <DueDateIndicator dueDate={job.due_date} />
          </TableCell>
          <TableCell>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(job.uploaded_at || job.due_date), { addSuffix: true })}
            </p>
          </TableCell>
          <TableCell>
            {getStatusBadge(job.status)}
          </TableCell>
          <TableCell className="text-right">
            <JobActions 
              jobId={job.id}
              pdfUrl={job.pdf_url}
              onJobDeleted={onDeleteJob}
            />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
};

export default JobsTable;
