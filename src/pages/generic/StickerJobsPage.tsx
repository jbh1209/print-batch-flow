
import React from "react";
import { productConfigs } from "@/config/productTypes";
import { useGenericJobs } from "@/hooks/generic/useGenericJobs";
import GenericJobsPage from "@/components/generic/GenericJobsPage";
import { DebugInfo } from "@/components/ui/debug-info";
import { generateRenderKey } from "@/utils/cacheUtils";

const StickerJobsPage = () => {
  const config = productConfigs["Stickers"];
  const renderKey = generateRenderKey();
  
  console.log(`[StickerJobsPage] Rendering with key: ${renderKey}`);
  
  // Create a wrapper function that returns the hook result with standardized interface
  const jobsHookWrapper = () => {
    const hookResult = useGenericJobs(config);
    
    console.log(`[StickerJobsPage] Hook wrapper executed, jobs: ${hookResult.jobs.length}`);
    
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
        componentName="StickerJobsPage"
        extraInfo={{
          productType: config.productType,
          renderKey
        }}
      />
    </>
  );
};

export default StickerJobsPage;
