
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productConfigs } from '@/config/productTypes';
import { GenericJobForm } from '@/components/generic/GenericJobForm';

const BusinessCardJobEditPage = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const config = productConfigs["BusinessCards"];

  return (
    <GenericJobForm 
      config={config}
      mode="edit"
      initialData={{ id: jobId }}
      onSuccess={() => navigate('/batches/business-cards/jobs')}
    />
  );
};

export default BusinessCardJobEditPage;
