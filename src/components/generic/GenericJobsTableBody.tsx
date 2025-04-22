
import React from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow, TableBody } from "@/components/ui/table";
import JobStatusBadge from "@/components/JobStatusBadge";
import { ProductConfig, BaseJob } from "@/config/productTypes";
import { EmptyJobsMessage } from "@/components/flyers/components/EmptyJobsMessage";
import { toast } from "sonner";

interface GenericJobsTableBodyProps {
  config: ProductConfig;
  jobs: BaseJob[];
  selectedJobs: BaseJob[];
  handleSelectJob: (id: string, isSelected: boolean) => void;
  deleteJob: (id: string) => Promise<boolean>;
}

export const GenericJobsTableBody: React.FC<GenericJobsTableBodyProps> = ({ 
  config, 
  jobs, 
  selectedJobs, 
  handleSelectJob,
  deleteJob
}) => {
  const navigate = useNavigate();

  const handleDeleteJob = async (jobId: string) => {
    try {
      await deleteJob(jobId);
      toast.success("Job deleted successfully");
    } catch (error) {
      toast.error("Failed to delete job");
      console.error("Error deleting job:", error);
    }
  };

  const handleViewJob = (jobId: string) => {
    navigate(config.routes.jobDetailPath(jobId));
  };

  const handleEditJob = (jobId: string) => {
    navigate(config.routes.jobEditPath(jobId));
  };

  return (
    <TableBody>
      {jobs.length === 0 ? (
        <EmptyJobsMessage colSpan={9} />
      ) : (
        jobs.map((job) => {
          const isSelected = selectedJobs.some(selectedJob => selectedJob.id === job.id);
          const canSelect = job.status === "queued";
          
          return (
            <TableRow key={job.id} className={isSelected ? "bg-primary/5" : undefined}>
              <TableCell>
                <Checkbox 
                  checked={isSelected} 
                  onCheckedChange={(checked) => handleSelectJob(job.id, checked === true)}
                  disabled={!canSelect}
                />
              </TableCell>
              <TableCell className="font-medium">{job.name}</TableCell>
              <TableCell>{job.job_number}</TableCell>
              
              {/* Size field - conditionally render based on product config */}
              {config.hasSize && (
                <TableCell>{(job as any).size}</TableCell>
              )}
              
              {/* Paper field - conditionally render based on product config */}
              {(config.hasPaperType || config.hasPaperWeight) && (
                <TableCell>
                  {(job as any).paper_weight} {(job as any).paper_type}
                </TableCell>
              )}
              
              <TableCell>{job.quantity}</TableCell>
              <TableCell>
                {format(new Date(job.due_date), "dd MMM yyyy")}
              </TableCell>
              <TableCell>
                <JobStatusBadge status={job.status} />
              </TableCell>
              <TableCell>
                <div className="flex gap-2 justify-end">
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    title="View Job"
                    onClick={() => handleViewJob(job.id)}
                  >
                    <Eye size={16} />
                  </Button>
                  {job.status === 'queued' && (
                    <>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        title="Edit Job"
                        onClick={() => handleEditJob(job.id)}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        title="Delete Job"
                        onClick={() => handleDeleteJob(job.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })
      )}
    </TableBody>
  );
};
