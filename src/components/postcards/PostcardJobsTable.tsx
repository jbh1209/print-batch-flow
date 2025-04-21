
import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Trash2 } from 'lucide-react';
import EmptyState from '../business-cards/EmptyState';

interface PostcardJobsTableProps {
  jobs: any[];
  isLoading: boolean;
  error: string | null;
  onViewJob: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
  onRefresh: () => void;
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

  return (
    <div className="p-8">
      <EmptyState 
        type="empty" 
        entityName="jobs"
        createPath="/batches/postcards/jobs/new"
      />
    </div>
  );
};
