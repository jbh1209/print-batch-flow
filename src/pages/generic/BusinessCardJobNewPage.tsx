
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productConfigs } from '@/config/productTypes';
import { GenericJobForm } from '@/components/generic/GenericJobForm';

const BusinessCardJobNewPage = () => {
  const navigate = useNavigate();
  const config = productConfigs["Business Cards"];
  
  // Add debugging to check if config is available
  useEffect(() => {
    console.log("BusinessCardJobNewPage rendering with config:", config);
    if (!config) {
      console.error("Config not found for Business Cards");
    }
  }, [config]);

  if (!config) {
    return <div className="p-8">Error: Product config not found</div>;
  }

  return (
    <GenericJobForm 
      config={config}
      mode="create"
    />
  );
};

export default BusinessCardJobNewPage;
