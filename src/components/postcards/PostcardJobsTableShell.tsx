
import React from 'react';
import { Table } from '@/components/ui/table';
import EmptyState from '../business-cards/EmptyState';
import { PostcardJobsTableHeader } from './components/PostcardJobsTableHeader';
import { PostcardJobsTableBody } from './components/PostcardJobsTableBody';

interface PostcardJobsTableShellProps {
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  jobs?: any[];
  onViewJob?: (jobId: string) => void;
  onDeleteJob?: (jobId: string) => void;
}

const PostcardJobsTableShell: React.FC<PostcardJobsTableShellProps> = ({
  isLoading,
  error,
  onRefresh,
  jobs = [],
  onViewJob = () => {},
  onDeleteJob = () => {},
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

  return (
    <Table>
      <PostcardJobsTableHeader />
      <PostcardJobsTableBody 
        jobs={jobs} 
        onViewJob={onViewJob} 
        onDeleteJob={onDeleteJob} 
      />
    </Table>
  );
};

export default PostcardJobsTableShell;
