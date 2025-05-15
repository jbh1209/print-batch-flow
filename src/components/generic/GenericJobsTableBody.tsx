
import React from 'react';
import { TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, Pencil, Trash } from 'lucide-react';
import { BaseJob, ProductConfig } from '@/config/productTypes';
import { calculateJobUrgency, getUrgencyBackgroundClass } from '@/utils/dateCalculations';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface GenericJobsTableBodyProps {
  jobs: BaseJob[];
  config: ProductConfig;
  selectedJobs: string[];
  onSelectJob: (jobId: string, isSelected: boolean) => void;
  onDeleteJob: (jobId: string) => void;
  onEditJob?: (jobId: string) => void;
  onViewJob?: (jobId: string) => void;
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
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch (error) {
      return dateString || 'N/A';
    }
  };

  const isJobSelectable = (job: BaseJob) => {
    // Only queued jobs can be selected for batching
    return job.status === "queued";
  };

  // Get row background color based on status and urgency
  const getRowBackgroundColor = (job: BaseJob) => {
    // Status-based coloring
    switch (job.status) {
      case 'completed': return 'bg-green-50';
      case 'cancelled': return 'bg-red-50';
      case 'batched': return 'bg-blue-50';
    }
    
    // If status doesn't determine color, use urgency
    const urgency = calculateJobUrgency(job.due_date, config);
    return getUrgencyBackgroundClass(urgency);
  };

  // Render empty state if no jobs
  if (jobs.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
          No jobs found
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableBody>
      {jobs.map((job) => {
        const isSelected = selectedJobs.includes(job.id);
        const canSelect = isJobSelectable(job);
        const rowClass = isSelected ? "bg-primary/5" : getRowBackgroundColor(job);
        
        return (
          <TableRow key={job.id} className={rowClass}>
            <TableCell>
              <Checkbox 
                checked={isSelected} 
                onCheckedChange={(checked) => onSelectJob(job.id, checked === true)}
                disabled={!canSelect}
              />
            </TableCell>
            <TableCell>{job.name || 'Unnamed Job'}</TableCell>
            <TableCell>{job.job_number || 'N/A'}</TableCell>
            {config.hasSize && <TableCell>{job.size || 'N/A'}</TableCell>}
            {config.productType === "Sleeves" ? (
              <TableCell>{job.stock_type || 'N/A'}</TableCell>
            ) : (
              <TableCell>
                {job.paper_type || 'N/A'}
                {job.paper_weight && `, ${job.paper_weight}`}
              </TableCell>
            )}
            <TableCell>{job.quantity || 0}</TableCell>
            <TableCell>{job.due_date ? formatDate(job.due_date) : 'No date set'}</TableCell>
            <TableCell>
              <Badge variant={job.status === 'queued' ? 'default' : 
                         job.status === 'batched' ? 'secondary' : 
                         job.status === 'completed' ? 'success' : 'destructive'}>
                {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                {onViewJob && (
                  <Button variant="ghost" size="icon" onClick={() => onViewJob(job.id)}>
                    <Eye className="h-4 w-4" />
                    <span className="sr-only">View</span>
                  </Button>
                )}
                {onEditJob && (
                  <Button variant="ghost" size="icon" onClick={() => onEditJob(job.id)}>
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Edit</span>
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => onDeleteJob(job.id)}>
                  <Trash className="h-4 w-4" />
                  <span className="sr-only">Delete</span>
                </Button>
              </div>
            </TableCell>
          </TableRow>
        );
      })}
    </TableBody>
  );
};

export default GenericJobsTableBody;
