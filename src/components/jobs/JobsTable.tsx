

import React from 'react';
import { format, isPast } from 'date-fns';
import { ArrowUpDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExtendedJob } from '@/hooks/useAllPendingJobs';
import { getUrgencyBackgroundClass } from '@/utils/dateCalculations';
import JobActions from './JobActions';

type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

interface JobsTableProps {
  jobs: ExtendedJob[];
  sortField: 'due_date' | 'productType';
  sortOrder: 'asc' | 'desc';
  toggleSort: (field: 'due_date' | 'productType') => void;
  onJobsChange?: () => void;
}

const JobsTable: React.FC<JobsTableProps> = ({
  jobs,
  sortField,
  sortOrder,
  toggleSort,
  onJobsChange
}) => {
  const navigate = useNavigate();

  const handleNavigateToJob = (job: ExtendedJob) => {
    // Create a more robust navigation system
    let detailPath: string;
    
    // Map product types to their detail paths
    switch (job.productConfig?.productType) {
      case 'Business Cards':
        // Business cards don't have individual job detail pages yet, navigate to jobs list
        detailPath = '/batches/business-cards/jobs';
        break;
      case 'Flyers':
        detailPath = `/batches/flyers/jobs/${job.id}`;
        break;
      case 'Postcards':
        detailPath = `/batches/postcards/jobs/${job.id}`;
        break;
      case 'Posters':
        detailPath = `/batches/posters/jobs/${job.id}`;
        break;
      case 'Sleeves':
        detailPath = `/batches/sleeves/jobs/${job.id}`;
        break;
      case 'Boxes':
        detailPath = `/batches/boxes/jobs/${job.id}`;
        break;
      case 'Covers':
        detailPath = `/batches/covers/jobs/${job.id}`;
        break;
      case 'Stickers':
        detailPath = `/batches/stickers/jobs/${job.id}`;
        break;
      default:
        console.warn(`Unknown product type: ${job.productConfig?.productType}`);
        // Fallback to the product's jobs list page
        const productSlug = job.productConfig?.productType?.toLowerCase().replace(/\s+/g, '-');
        detailPath = `/batches/${productSlug}/jobs`;
        break;
    }
    
    console.log(`Navigating to: ${detailPath} for job ${job.id} (${job.productConfig?.productType})`);
    navigate(detailPath);
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job</TableHead>
            <TableHead 
              className="cursor-pointer"
              onClick={() => toggleSort('productType')}
            >
              Product Type
              <ArrowUpDown size={14} className="ml-1 inline" />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => toggleSort('due_date')}
            >
              Due Date
              <ArrowUpDown size={14} className="ml-1 inline" />
            </TableHead>
            <TableHead>SLA Target</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                No jobs found matching your filters
              </TableCell>
            </TableRow>
          ) : (
            jobs.map((job) => (
              <TableRow 
                key={`${job.productConfig.tableName}-${job.id}`}
                className={`${getUrgencyBackgroundClass(job.urgency as UrgencyLevel)} hover:bg-muted/50`}
                style={{ 
                  borderLeft: `4px solid ${job.productConfig.ui.color || '#888'}` 
                }}
              >
                <TableCell>
                  <span 
                    className="cursor-pointer hover:underline text-blue-600"
                    onClick={() => handleNavigateToJob(job)}
                  >
                    {job.job_number}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge 
                    style={{ 
                      backgroundColor: job.productConfig.ui.color,
                      color: 'white' 
                    }}
                  >
                    {job.productConfig.productType}
                  </Badge>
                </TableCell>
                <TableCell>{job.name}</TableCell>
                <TableCell>{job.quantity}</TableCell>
                <TableCell>{job.reference || '-'}</TableCell>
                <TableCell>{format(new Date(job.due_date), 'MMM dd, yyyy')}</TableCell>
                <TableCell>
                  <span className="font-medium">
                    {job.urgency}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">Queued</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <JobActions 
                    job={job}
                    onJobDeleted={onJobsChange}
                    onJobUpdated={onJobsChange}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default JobsTable;

