import React from 'react';
import { PostcardJob } from '../batches/types/PostcardTypes';
import { Button } from '@/components/ui/button';
import { Eye, Trash2 } from 'lucide-react';
import EmptyState from '../business-cards/EmptyState';
import { laminationLabels } from './schema/postcardJobFormSchema';
import { format } from 'date-fns';

interface PostcardJobsTableProps {
  jobs: PostcardJob[];
  isLoading: boolean;
  error: string | null;
  onViewJob: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
  onRefresh: () => void;
  // New selection props:
  selectedJobs?: string[];
  onSelectJob?: (jobId: string, isSelected: boolean) => void;
  onSelectAllJobs?: (isSelected: boolean) => void;
  selectableJobIds?: string[];
}

export const PostcardJobsTable: React.FC<PostcardJobsTableProps> = ({
  jobs,
  isLoading,
  error,
  onViewJob,
  onDeleteJob,
  onRefresh,
  selectedJobs = [],
  onSelectJob,
  onSelectAllJobs,
  selectableJobIds = []
}) => {
  if (isLoading) {
    return (
      <div className="p-8">
        <EmptyState type="loading" entityName="jobs" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <EmptyState 
          type="error" 
          entityName="jobs" 
          errorMessage={error}
          onRetry={onRefresh}
        />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="p-8">
        <EmptyState 
          type="empty" 
          entityName="jobs"
          createPath="/batches/postcards/jobs/new"
        />
      </div>
    );
  }

  // Add selection logic to rows and header
  const allSelected = selectableJobIds.length > 0 && selectedJobs.length === selectableJobIds.length;

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-sm text-left">
                {/* Select All checkbox */}
                <input
                  type="checkbox"
                  className="accent-primary h-4 w-4"
                  checked={allSelected}
                  disabled={selectableJobIds.length === 0}
                  onChange={(e) => {
                    if (onSelectAllJobs) {
                      onSelectAllJobs(e.target.checked);
                    }
                  }}
                  aria-label="Select all jobs"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Job Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Job Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Paper
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Lamination
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {jobs.map((job) => {
              const isSelectable = job.status === "queued" && !job.batch_id;
              const isSelected = selectedJobs.includes(job.id);
              return (
                <tr 
                  key={job.id}
                  className={isSelected ? "bg-primary/5" : ""}
                >
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      className="accent-primary h-4 w-4"
                      checked={isSelected}
                      disabled={!isSelectable}
                      onChange={e => {
                        if (onSelectJob && isSelectable) {
                          onSelectJob(job.id, e.target.checked);
                        }
                      }}
                      aria-label={`Select job ${job.name}`}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{job.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{job.job_number}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{job.size}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{job.paper_type}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{laminationLabels[job.lamination_type]}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{job.quantity}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{formatDate(job.due_date)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${job.status === 'queued' ? 'bg-yellow-100 text-yellow-800' : 
                      job.status === 'batched' ? 'bg-blue-100 text-blue-800' : 
                      job.status === 'completed' ? 'bg-green-100 text-green-800' : 
                      'bg-gray-100 text-gray-800'}`}
                    >
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onViewJob(job.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => onDeleteJob(job.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
