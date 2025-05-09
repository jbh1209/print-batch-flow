
import React from 'react';
import { useParams } from 'react-router-dom';
import FormLoadingSpinner from '@/components/business-cards/FormLoadingSpinner';
import JobHeader from '@/components/business-cards/job-detail/JobHeader';
import JobDetailsCard from '@/components/business-cards/job-detail/JobDetailsCard';
import FileDetailsCard from '@/components/business-cards/job-detail/FileDetailsCard';
import ErrorDisplay from '@/components/business-cards/job-detail/ErrorDisplay';
import { useBusinessCardJobDetails } from '@/hooks/useBusinessCardJobDetails';

const BusinessCardJobDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { job, isLoading, error, handleViewPDF } = useBusinessCardJobDetails(id);

  if (isLoading) {
    return <FormLoadingSpinner message="Loading job details..." />;
  }

  if (error || !job) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <JobHeader job={job} />

      <div className="grid gap-6 md:grid-cols-2">
        <JobDetailsCard job={job} />
        <FileDetailsCard 
          file_name={job.file_name} 
          pdf_url={job.pdf_url}
          onViewPDF={handleViewPDF}
        />
      </div>
    </div>
  );
};

export default BusinessCardJobDetail;
