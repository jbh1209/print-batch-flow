
import React from "react";
import { productConfigs } from "@/config/productTypes";
import { useGenericFlyerJobs } from "@/hooks/generic/useGenericFlyerJobs";
import GenericJobsPage from "@/components/generic/GenericJobsPage";
import { DebugInfo } from "@/components/ui/debug-info";
import { generateRenderKey } from "@/utils/cacheUtils";

const FlyerJobsPage = () => {
  const config = productConfigs["Flyers"];
  const renderKey = generateRenderKey();
  
  console.log(`[FlyerJobsPage] Rendering with key: ${renderKey}`);
  
  // Create a wrapper function that returns the hook result with standardized interface
  const jobsHookWrapper = () => {
    const hookResult = useGenericFlyerJobs();
    
    console.log(`[FlyerJobsPage] Hook wrapper executed, jobs: ${hookResult.jobs.length}`);
    
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

  // Use key to force re-render of the component tree
  return (
    <>
      <GenericJobsPage 
        key={renderKey} 
        config={config} 
        useJobsHook={jobsHookWrapper} 
      />
      <DebugInfo
        componentName="FlyerJobsPage"
        extraInfo={{
          productType: config.productType,
          renderKey
        }}
      />
    </>
  );
};

export default FlyerJobsPage;
