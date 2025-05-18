
import React from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import JobStatusBadge from '@/components/JobStatusBadge';

interface JobDetailsCardProps {
  job: {
    status: string;
    quantity: number;
    paper_type: string;
    lamination_type: string;
    double_sided: boolean;
    created_at: string;
    due_date: string;
    batch_id?: string | null;
  };
}

const JobDetailsCard: React.FC<JobDetailsCardProps> = ({ job }) => {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <div className="font-medium text-gray-500">Status</div>
            <div className="mt-1">
              <JobStatusBadge status={job.status} />
            </div>
          </div>

          <div>
            <div className="font-medium text-gray-500">Quantity</div>
            <div className="mt-1">{job.quantity}</div>
          </div>

          <div>
            <div className="font-medium text-gray-500">Paper Type</div>
            <div className="mt-1">{job.paper_type}</div>
          </div>

          <div>
            <div className="font-medium text-gray-500">Lamination</div>
            <div className="mt-1">
              {job.lamination_type === 'none' ? 'None' : 
                job.lamination_type.charAt(0).toUpperCase() + job.lamination_type.slice(1)}
            </div>
          </div>

          <div>
            <div className="font-medium text-gray-500">Double Sided</div>
            <div className="mt-1">{job.double_sided ? 'Yes' : 'No'}</div>
          </div>

          <div>
            <div className="font-medium text-gray-500">Created At</div>
            <div className="mt-1">{formatDate(job.created_at)}</div>
          </div>

          <div>
            <div className="font-medium text-gray-500">Due Date</div>
            <div className="mt-1">{formatDate(job.due_date)}</div>
          </div>

          {job.batch_id && (
            <div>
              <div className="font-medium text-gray-500">Batch</div>
              <div className="mt-1">
                <Badge variant="secondary" className="text-xs">
                  {job.batch_id}
                </Badge>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default JobDetailsCard;
