
import React, { useEffect } from 'react';
import { productConfigs } from "@/config/productTypes";
import GenericJobsPage from "@/components/generic/GenericJobsPage";
import { useGenericJobs } from "@/hooks/generic/useGenericJobs";

const BusinessCardJobsPage = () => {
  const config = productConfigs["Business Cards"];
  
  // Add debugging to check if config is available
  useEffect(() => {
    console.log("BusinessCardJobsPage rendering with config:", config);
    if (!config) {
      console.error("Config not found for Business Cards");
    }
  }, [config]);

  if (!config) {
    return <div className="p-8">Error: Product config not found</div>;
  }
  
  // Create a wrapper function that returns the hook result
  const jobsHookWrapper = () => {
    const hookResult = useGenericJobs(config);
    return hookResult;
  };

  return <GenericJobsPage config={config} useJobsHook={jobsHookWrapper} />;
};

export default BusinessCardJobsPage;
