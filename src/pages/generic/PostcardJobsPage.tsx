
import React from "react";
import { productConfigs } from "@/config/productTypes";
import { useGenericJobs } from "@/hooks/generic/useGenericJobs";
import GenericJobsPage from "@/components/generic/GenericJobsPage";
import { DebugInfo } from "@/components/ui/debug-info";
import { generateRenderKey } from "@/utils/cacheUtils";

const PostcardJobsPage = () => {
  const config = productConfigs["Postcards"];
  const renderKey = generateRenderKey();
  
  console.log(`[PostcardJobsPage] Rendering with key: ${renderKey}`);
  
  // Create a wrapper function that returns the hook result with standardized interface
  const jobsHookWrapper = () => {
    const hookResult = useGenericJobs(config);
    
    console.log(`[PostcardJobsPage] Hook wrapper executed, jobs: ${hookResult.jobs.length}`);
    
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
        componentName="PostcardJobsPage"
        extraInfo={{
          productType: config.productType,
          renderKey
        }}
      />
    </>
  );
};

export default PostcardJobsPage;
