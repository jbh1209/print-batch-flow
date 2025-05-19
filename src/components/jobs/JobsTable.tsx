
import React from 'react';
import { format, isPast } from 'date-fns';
import { ArrowUpDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExtendedJob } from '@/hooks/useAllPendingJobs';
import { getUrgencyBackgroundClass } from '@/utils/dateCalculations';

interface JobsTableProps {
  jobs: ExtendedJob[];
  sortField: 'due_date' | 'productType';
  sortOrder: 'asc' | 'desc';
  toggleSort: (field: 'due_date' | 'productType') => void;
}

const JobsTable: React.FC<JobsTableProps> = ({
  jobs,
  sortField,
  sortOrder,
  toggleSort
}) => {
  const navigate = useNavigate();

  const handleNavigateToJob = (job: ExtendedJob) => {
    if (!job.productConfig?.routes?.jobDetailPath) {
      console.error("Cannot navigate: job detail path not defined for", job.productConfig?.productType);
      return;
    }
    
    const detailPath = job.productConfig.routes.jobDetailPath(job.id);
    console.log("Navigating to:", detailPath);
    navigate(detailPath);
  };

  // Function to determine row background color based on status and urgency
  const getRowBackgroundColor = (job: ExtendedJob) => {
    // First priority: status-based coloring
    if (job.status === "completed") return "bg-green-50";
    if (job.status === "cancelled") return "bg-red-50";
    
    // Second priority: urgency-based coloring
    return getUrgencyBackgroundClass(job.urgency);
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
            <TableHead
              className="cursor-pointer"
              onClick={() => toggleSort('due_date')}
            >
              Due Date
              <ArrowUpDown size={14} className="ml-1 inline" />
            </TableHead>
            <TableHead>SLA Target</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                No jobs found matching your filters
              </TableCell>
            </TableRow>
          ) : (
            jobs.map((job) => (
              <TableRow 
                key={`${job.productConfig.tableName}-${job.id}`}
                className={getRowBackgroundColor(job)}
                onClick={() => handleNavigateToJob(job)}
                style={{ 
                  cursor: 'pointer',
                  borderLeft: `4px solid ${job.productConfig.ui.color || '#888'}` 
                }}
              >
                <TableCell>{job.job_number}</TableCell>
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
                <TableCell>{format(new Date(job.due_date), 'MMM dd, yyyy')}</TableCell>
                <TableCell>
                  <span className="font-medium">
                    {job.urgency}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">Queued</Badge>
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
