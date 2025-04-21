
import { TableBody, TableCell, TableRow } from '@/components/ui/table';
import { PostcardJob } from '@/components/batches/types/PostcardTypes';
import { format } from 'date-fns';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import JobStatusBadge from '@/components/JobStatusBadge';
import { laminationLabels } from '../schema/postcardJobFormSchema';

interface PostcardJobsTableBodyProps {
  jobs: PostcardJob[];
  onViewJob: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
}

export const PostcardJobsTableBody = ({ 
  jobs, 
  onViewJob, 
  onDeleteJob 
}: PostcardJobsTableBodyProps) => {
  return (
    <TableBody>
      {jobs.map((job) => (
        <TableRow key={job.id}>
          <TableCell className="font-medium">{job.name}</TableCell>
          <TableCell>{job.job_number}</TableCell>
          <TableCell>{job.size}</TableCell>
          <TableCell>{job.paper_type}</TableCell>
          <TableCell>
            {job.lamination_type ? laminationLabels[job.lamination_type as keyof typeof laminationLabels] : 'None'}
          </TableCell>
          <TableCell>{job.quantity}</TableCell>
          <TableCell>{format(new Date(job.due_date), 'MMM dd, yyyy')}</TableCell>
          <TableCell>
            <JobStatusBadge status={job.status as "queued" | "batched" | "completed" | "cancelled"} />
          </TableCell>
          <TableCell>
            <div className="flex gap-2 justify-end">
              <Button 
                size="icon" 
                variant="ghost" 
                title="View Job"
                onClick={() => onViewJob(job.id)}
              >
                <Eye size={16} />
              </Button>
              {job.status === 'queued' && (
                <>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    title="Edit Job"
                    onClick={() => onViewJob(job.id)}
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
