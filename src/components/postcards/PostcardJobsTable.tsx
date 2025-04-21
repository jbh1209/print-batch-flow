
import React from 'react';
import { Table } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/flyers/components/LoadingSpinner';
import { PostcardJobsTableHeader } from './components/PostcardJobsTableHeader';
import { PostcardJobsTableBody } from './components/PostcardJobsTableBody';
import { EmptyJobsMessage } from '@/components/flyers/components/EmptyJobsMessage';
import { usePostcardJobs } from '@/hooks/usePostcardJobs';

export const PostcardJobsTable = () => {
  const { jobs, isLoading, error, fetchJobs, handleViewJob, handleDeleteJob } = usePostcardJobs();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border shadow p-8">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading jobs</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button 
            onClick={fetchJobs} 
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg border border-dashed border-gray-300 p-8">
        <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">No postcard jobs found</h3>
        <p className="text-gray-500 text-center mb-4">Get started by creating your first postcard job.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border shadow overflow-hidden">
      <Table>
        <PostcardJobsTableHeader />
        <PostcardJobsTableBody 
          jobs={jobs} 
          onViewJob={handleViewJob} 
          onDeleteJob={handleDeleteJob} 
        />
      </Table>
    </div>
  );
};
