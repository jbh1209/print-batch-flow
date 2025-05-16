
import React from "react";
import { productConfigs } from "@/config/productTypes";
import { useGenericJobs } from "@/hooks/generic/useGenericJobs";
import GenericJobsPage from "@/components/generic/GenericJobsPage";
import { DebugInfo } from "@/components/ui/debug-info";
import { generateRenderKey } from "@/utils/cacheUtils";

const PosterJobsPage = () => {
  const config = productConfigs["Posters"];
  const renderKey = generateRenderKey();
  
  console.log(`[PosterJobsPage] Rendering with key: ${renderKey}`);
  
  // Create a wrapper function that returns the hook result with standardized interface
  const jobsHookWrapper = () => {
    const hookResult = useGenericJobs(config);
    
    console.log(`[PosterJobsPage] Hook wrapper executed, jobs: ${hookResult.jobs.length}`);
    
    return {
      jobs: hookResult.jobs,
      isLoading: hookResult.isLoading,
      error: hookResult.error,
      deleteJob: hookResult.deleteJob,
      fetchJobs: hookResult.fetchJobs,
      createBatch: hookResult.createBatch,
      isCreatingBatch: hookResult.isCreatingBatch,
      fixBatchedJobsWithoutBatch: hookResult.fixBatchedJobsWithoutBatch,
      isFixingBatchedJobs: hookResult.isFixingBatchedJobs
    };
  };

  return (
    <>
      <GenericJobsPage 
        key={renderKey} 
        config={config} 
        useJobsHook={jobsHookWrapper} 
      />
      <DebugInfo
        componentName="PosterJobsPage"
        extraInfo={{
          productType: config.productType,
          renderKey
        }}
      />
    </>
  );
};

export default PosterJobsPage;
