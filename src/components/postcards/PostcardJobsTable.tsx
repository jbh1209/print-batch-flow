
import React from 'react';
import PostcardJobsTableShell from './PostcardJobsTableShell';

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
  isLoading,
  error,
  onRefresh,
}) => {
  return (
    <PostcardJobsTableShell
      isLoading={isLoading}
      error={error}
      onRefresh={onRefresh}
    />
  );
};

