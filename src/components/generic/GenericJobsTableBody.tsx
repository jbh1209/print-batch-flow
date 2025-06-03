
import React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Eye, Trash2, FileText } from "lucide-react";
import JobStatusBadge from "@/components/JobStatusBadge";
import { ProductConfig, BaseJob } from "@/config/productTypes";

interface GenericJobsTableBodyProps {
  jobs: BaseJob[];
  isLoading: boolean;
  error: string | null;
  selectedJobs: string[];
  onSelectJob: (jobId: string, isSelected: boolean) => void;
  onDeleteJob: (jobId: string) => Promise<void>;
  onViewJob?: (jobId: string) => void;
  config: ProductConfig;
}

const GenericJobsTableBody: React.FC<GenericJobsTableBodyProps> = ({
  jobs,
  isLoading,
  error,
  selectedJobs,
  onSelectJob,
  onDeleteJob,
  onViewJob,
  config
}) => {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM dd, yyyy");
    } catch (error) {
      return dateString;
    }
  };

  const isJobSelectable = (job: BaseJob) => {
    return job.status === "queued";
  };

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={10} className="h-24 text-center">
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (error) {
    return (
      <TableRow>
        <TableCell colSpan={10} className="h-24 text-center">
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-red-500">{error}</p>
            <Button variant="outline" size="sm" className="mt-2">
              Retry
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (jobs.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={10} className="h-24 text-center">
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-gray-500">No jobs found</p>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
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
            <TableCell 
              className="font-medium cursor-pointer hover:text-primary"
              onClick={() => onViewJob && onViewJob(job.id)}
            >
              {job.name}
            </TableCell>
            <TableCell>
              <span
                className="text-blue-600 hover:underline cursor-pointer"
                onClick={() => {
                  if (job.pdf_url) {
                    window.open(job.pdf_url, "_blank");
                  }
                }}
              >
                {job.file_name}
              </span>
            </TableCell>
            <TableCell>{job.quantity}</TableCell>
            {config.hasSize && <TableCell>{job.size || "-"}</TableCell>}
            {config.hasPaperType && <TableCell>{job.paper_type || "-"}</TableCell>}
            {(job.lamination_type !== undefined) && (
              <TableCell>
                {job.lamination_type === "none"
                  ? "None"
                  : job.lamination_type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
              </TableCell>
            )}
            <TableCell>{job.reference || "-"}</TableCell>
            <TableCell>
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  new Date(job.due_date) < new Date() 
                    ? "bg-red-500" 
                    : new Date(job.due_date) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) 
                      ? "bg-yellow-500" 
                      : "bg-green-500"
                }`}></div>
                {formatDate(job.due_date)}
              </div>
            </TableCell>
            <TableCell>{formatDate(job.created_at)}</TableCell>
            <TableCell>
              <JobStatusBadge status={job.status} />
            </TableCell>
            <TableCell>
              <div className="flex space-x-2 justify-end">
                {onViewJob && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onViewJob(job.id)}
                    title="View Job Details"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => job.pdf_url && window.open(job.pdf_url, "_blank")}
                  title="View PDF"
                >
                  <FileText className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDeleteJob(job.id)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  title="Delete Job"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
};

export default GenericJobsTableBody;
