
import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { TableRow, TableCell, TableBody } from "@/components/ui/table";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash } from "lucide-react";
import JobStatusBadge from "@/components/JobStatusBadge";
import { DueDateIndicator } from "@/components/batches/DueDateIndicator";
import { ProductConfig, BaseJob } from "@/config/productTypes";

interface GenericJobsTableBodyProps {
  jobs: BaseJob[];
  config: ProductConfig;
  selectedJobs: string[];
  onSelectJob: (jobId: string, isSelected: boolean) => void;
  onDeleteJob: (jobId: string) => void;
  onEditJob: (jobId: string) => void;
  onViewJob: (jobId: string) => void;
}

const GenericJobsTableBody: React.FC<GenericJobsTableBodyProps> = ({
  jobs,
  config,
  selectedJobs,
  onSelectJob,
  onDeleteJob,
  onEditJob,
  onViewJob,
}) => {
  // Check if a job is selectable (only queued jobs)
  const isJobSelectable = (job: BaseJob) => job.status === "queued";

  // Get row background color based on selection status
  const getRowBackgroundColor = (job: BaseJob) => {
    if (selectedJobs.includes(job.id)) {
      return "bg-primary/5";
    }
    return "";
  };

  return (
    <TableBody>
      {jobs.map((job) => {
        const isSelected = selectedJobs.includes(job.id);
        const canSelect = isJobSelectable(job);

        return (
          <TableRow key={job.id} className={getRowBackgroundColor(job)}>
            <TableCell>
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelectJob(job.id, checked === true)}
                disabled={!canSelect}
              />
            </TableCell>
            <TableCell>{job.name}</TableCell>
            <TableCell>{job.job_number}</TableCell>
            {config.hasSize && <TableCell>{job.size}</TableCell>}
            <TableCell>{job.productType === "Sleeves" ? job.stock_type : job.paper_type}</TableCell>
            <TableCell>{job.quantity}</TableCell>
            <TableCell>
              <DueDateIndicator dueDate={job.due_date} />
            </TableCell>
            <TableCell>
              <JobStatusBadge status={job.status} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onViewJob(job.id)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {job.status === "queued" && (
                  <>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onEditJob(job.id)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onDeleteJob(job.id)}
                    >
                      <Trash className="h-4 w-4 text-red-500" />
                    </Button>
                  </>
                )}
              </div>
            </TableCell>
          </TableRow>
        );
      })}
    </TableBody>
  );
};

export default GenericJobsTableBody;
