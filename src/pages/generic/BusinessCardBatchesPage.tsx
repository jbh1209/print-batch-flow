
import React, { useEffect } from 'react';
import { productConfigs } from "@/config/productTypes";
import GenericBatchesPage from "@/components/generic/GenericBatchesPage";

const BusinessCardBatchesPage = () => {
  const config = productConfigs["Business Cards"];
  
  // Add debugging to check if config is available
  useEffect(() => {
    console.log("BusinessCardBatchesPage rendering with config:", config);
    if (!config) {
      console.error("Config not found for Business Cards");
    }
  }, [config]);

  if (!config) {
    return <div className="p-8">Error: Product config not found</div>;
  }
  
  return (
    <GenericBatchesPage config={config} />
  );
};

export default BusinessCardBatchesPage;
