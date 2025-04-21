
import React from 'react';
import EmptyState from '../business-cards/EmptyState';

interface PostcardJobsTableShellProps {
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const PostcardJobsTableShell: React.FC<PostcardJobsTableShellProps> = ({
  isLoading,
  error,
  onRefresh,
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

export default PostcardJobsTableShell;
