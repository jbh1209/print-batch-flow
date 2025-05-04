
import { productConfigs } from "@/config/productTypes";
import { useGenericJobs } from "@/hooks/generic/useGenericJobs";
import GenericJobsPage from "@/components/generic/GenericJobsPage";
import { useEffect } from "react";

const StickerJobsPage = () => {
  const config = productConfigs["Stickers"];
  
  // Create a wrapper function that returns the hook result with type conversion
  const jobsHookWrapper = () => {
    const hookResult = useGenericJobs(config);
    
    // Create a wrapper for fixBatchedJobsWithoutBatch that matches expected return type
    const fixBatchedJobsWrapper = async () => {
      await hookResult.fixBatchedJobsWithoutBatch();
      // Return type is void as expected
    };
    
    // Add better debug logging to track the flow
    useEffect(() => {
      console.log("Stickers config loaded:", config);
      console.log("Available paper types for stickers:", config.availablePaperTypes);
      console.log("Available lamination types for stickers:", config.availableLaminationTypes);
    }, []);
    
    return {
      ...hookResult,
      fixBatchedJobsWithoutBatch: fixBatchedJobsWrapper
    };
  };

  return <GenericJobsPage config={config} useJobsHook={jobsHookWrapper} />;
};

export default StickerJobsPage;
