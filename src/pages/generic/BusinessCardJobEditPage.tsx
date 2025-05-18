
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productConfigs } from '@/config/productTypes';
import GenericJobForm from '@/components/generic/GenericJobForm';

const BusinessCardJobEditPage = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const config = productConfigs["Business Cards"];

  return (
    <GenericJobForm 
      config={config}
      jobId={jobId}
      isEditing={true}
      onSuccess={() => navigate('/batches/business-cards/jobs')}
    />
  );
};

export default BusinessCardJobEditPage;
