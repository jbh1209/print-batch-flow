
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
      console.log("Table name for stickers:", config.tableName);
    }, []);
    
    // Add a specialized wrapper for createBatch to handle sticker-specific logic
    const createBatchWrapper = async (selectedJobs, batchProperties) => {
      console.log("Creating sticker batch with properties:", batchProperties);
      console.log("Selected jobs:", selectedJobs);
      try {
        const result = await hookResult.createBatch(selectedJobs, batchProperties);
        console.log("Batch creation result:", result);
        return result;
      } catch (err) {
        console.error("Error in sticker batch creation:", err);
        throw err;
      }
    };
    
    return {
      ...hookResult,
      fixBatchedJobsWithoutBatch: fixBatchedJobsWrapper,
      createBatch: createBatchWrapper
    };
  };

  return <GenericJobsPage config={config} useJobsHook={jobsHookWrapper} />;
};

export default StickerJobsPage;
