
import React from "react";
import { format } from "date-fns";
import { FileText, Pencil, Trash2 } from "lucide-react";
import { TableCell, TableRow, TableBody } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BaseJob, ProductConfig } from "@/config/productTypes";
import { useNavigate } from "react-router-dom";
import JobStatusBadge from "@/components/JobStatusBadge";
import { calculateJobUrgency, getUrgencyBackgroundClass } from "@/utils/dateCalculations";

interface GenericJobsTableBodyProps {
  jobs: BaseJob[];
  config: ProductConfig;
  selectedJobs: string[];
  onSelectJob: (jobId: string, isSelected: boolean) => void;
  onDeleteJob: (jobId: string) => void;
  onEditJob: (jobId: string) => void;
}

const GenericJobsTableBody: React.FC<GenericJobsTableBodyProps> = ({
  jobs,
  config,
  selectedJobs,
  onSelectJob,
  onDeleteJob,
  onEditJob
}) => {
  const navigate = useNavigate();

  // Get row background class based on urgency and status
  const getRowBackgroundClass = (job: BaseJob) => {
    if (selectedJobs.includes(job.id)) return "bg-primary/5";
    
    // Status-based coloring
    switch (job.status) {
      case 'completed': return 'bg-green-50';
      case 'batched': return 'bg-blue-50';
      case 'cancelled': return 'bg-red-50';
    }
    
    // If status doesn't determine color, use urgency
    const urgency = calculateJobUrgency(job.due_date, config);
    return getUrgencyBackgroundClass(urgency);
  };

  // Format date string
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yyyy");
    } catch (error) {
      return "Invalid date";
    }
  };

  return (
    <TableBody>
      {jobs.map(job => (
        <TableRow key={job.id} className={getRowBackgroundClass(job)}>
          <TableCell>
            <Checkbox 
              checked={selectedJobs.includes(job.id)} 
              onCheckedChange={(checked) => onSelectJob(job.id, checked === true)}
              disabled={job.status !== "queued"} 
            />
          </TableCell>
          <TableCell className="font-medium">{job.name || "Untitled"}</TableCell>
          <TableCell>{job.job_number}</TableCell>
          {config.hasSize && <TableCell>{job.size || "N/A"}</TableCell>}
          <TableCell>
            {config.productType === "Sleeves" ? job.stock_type : 
              <>
                {job.paper_weight && `${job.paper_weight} `}
                {job.paper_type || "Standard"}
                {job.lamination_type && job.lamination_type !== "none" && (
                  <Badge variant="outline" className="ml-2">
                    {job.lamination_type.replace("_", " ")}
                  </Badge>
                )}
              </>
            }
          </TableCell>
          <TableCell>{job.quantity}</TableCell>
          <TableCell>{formatDate(job.due_date)}</TableCell>
          <TableCell>
            <JobStatusBadge status={job.status} />
          </TableCell>
          <TableCell>
            <div className="flex gap-2 justify-end">
              <Button
                size="icon"
                variant="ghost"
                title="View Job Details"
                onClick={() => navigate(config.routes.jobDetailPath(job.id))}
              >
                <FileText size={16} />
              </Button>
              
              {job.status === "queued" && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Edit Job"
                    onClick={() => onEditJob(job.id)}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Delete Job"
                    onClick={() => onDeleteJob(job.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 size={16} />
                  </Button>
                </>
              )}
            </div>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
};

export default GenericJobsTableBody;
