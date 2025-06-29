
import { format } from "date-fns";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import JobStatusBadge from "@/components/JobStatusBadge";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useFlyerJobs } from "@/hooks/useFlyerJobs";
import { useState } from "react";

interface FlyerJobRowProps {
  job: FlyerJob;
  isSelected: boolean;
  onSelectJob: (id: string, isSelected: boolean) => void;
}

export const FlyerJobRow = ({ 
  job, 
  isSelected, 
  onSelectJob 
}: FlyerJobRowProps) => {
  const navigate = useNavigate();
  const { deleteJob } = useFlyerJobs();
  const [isDeleting, setIsDeleting] = useState(false);
  const canSelect = job.status === "queued";
  
  const handleDelete = async () => {
    if (isDeleting) return; // Prevent double-clicks
    
    setIsDeleting(true);
    
    try {
      console.log("Deleting flyer job:", job.id);
      await deleteJob(job.id);
      toast.success("Job deleted successfully");
    } catch (error) {
      console.error("Error deleting flyer job:", error);
      toast.error("Failed to delete job");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = () => {
    try {
      navigate(`/batchflow/batches/flyers/jobs/${job.id}/edit`);
    } catch (error) {
      console.error("Error navigating to edit:", error);
      toast.error("Failed to open edit page");
    }
  };
  
  return (
    <TableRow key={job.id} className={isSelected ? "bg-primary/5" : undefined}>
      <TableCell>
        <Checkbox 
          checked={isSelected} 
          onCheckedChange={(checked) => onSelectJob(job.id, checked === true)}
          disabled={!canSelect}
        />
      </TableCell>
      <TableCell className="font-medium">{job.job_number}</TableCell>
      <TableCell>{job.name}</TableCell>
      <TableCell>{job.size}</TableCell>
      <TableCell>
        {job.paper_weight} {job.paper_type}
      </TableCell>
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
            onClick={() => navigate(`/batchflow/batches/flyers/jobs/${job.id}`)}
            disabled={isDeleting}
          >
            <Eye size={16} />
          </Button>
          {job.status === 'queued' && (
            <>
              <Button 
                size="icon" 
                variant="ghost" 
                title="Edit Job"
                onClick={handleEdit}
                disabled={isDeleting}
              >
                <Pencil size={16} />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                title="Delete Job"
                onClick={handleDelete}
                disabled={isDeleting}
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
};
