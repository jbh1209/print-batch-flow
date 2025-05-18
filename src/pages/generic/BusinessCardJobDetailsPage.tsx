
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { productConfigs } from '@/config/productTypes';
import GenericJobDetailsPage from '@/pages/generic/GenericJobDetailsPage';

const BusinessCardJobDetailsPage = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const config = productConfigs["Business Cards"];

  // Add debugging to check if config is available
  useEffect(() => {
    console.log("BusinessCardJobDetailsPage rendering with config:", config);
    if (!config) {
      console.error("Config not found for Business Cards");
    }
    console.log("JobId:", jobId);
  }, [config, jobId]);

  if (!config) {
    return <div className="p-8">Error: Product config not found</div>;
  }

  return <GenericJobDetailsPage productType="Business Cards" />;
};

export default BusinessCardJobDetailsPage;
