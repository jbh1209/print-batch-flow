
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { productConfigs } from '@/config/productTypes';
import { GenericJobForm } from '@/components/generic/GenericJobForm';

const BusinessCardJobNewPage = () => {
  const navigate = useNavigate();
  const config = productConfigs["BusinessCards"];

  return (
    <GenericJobForm 
      config={config}
      mode="create"
    />
  );
};

export default BusinessCardJobNewPage;
