
import { format } from "date-fns";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import JobStatusBadge from "@/components/JobStatusBadge";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { useNavigate } from "react-router-dom";

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
  const canSelect = job.status === "queued";
  
  return (
    <TableRow key={job.id} className={isSelected ? "bg-primary/5" : undefined}>
      <TableCell>
        <Checkbox 
          checked={isSelected} 
          onCheckedChange={(checked) => onSelectJob(job.id, checked === true)}
          disabled={!canSelect}
        />
      </TableCell>
      <TableCell className="font-medium">{job.name}</TableCell>
      <TableCell>{job.job_number}</TableCell>
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
        <Button 
          size="icon" 
          variant="ghost" 
          title="View Job"
          onClick={() => navigate(`/batches/flyers/jobs/${job.id}`)}
        >
          <Eye size={16} />
        </Button>
      </TableCell>
    </TableRow>
  );
};
