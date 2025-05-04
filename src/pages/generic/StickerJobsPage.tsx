
import { productConfigs } from "@/config/productTypes";
import { useGenericJobs } from "@/hooks/generic/useGenericJobs";
import GenericJobsPage from "@/components/generic/GenericJobsPage";
import { useEffect } from "react";
import { isExistingTable } from "@/utils/database/tableValidation";

const StickerJobsPage = () => {
  const config = productConfigs["Stickers"];
  
  // Validate the config on component mount
  useEffect(() => {
    console.log("Stickers config loaded:", config);
    
    if (!config) {
      console.error("No configuration found for Stickers");
      return;
    }
    
    if (!config.tableName) {
      console.error("No table name defined for Stickers config");
      return;
    }
    
    const isValid = isExistingTable(config.tableName);
    console.log(`Table name "${config.tableName}" is ${isValid ? 'valid' : 'invalid'}`);
    
    console.log("Available paper types for stickers:", config.availablePaperTypes);
    console.log("Available lamination types for stickers:", config.availableLaminationTypes);
  }, []);
  
  // Create a wrapper function that returns the hook result with type conversion
  const jobsHookWrapper = () => {
    const hookResult = useGenericJobs(config);
    
    // Create a wrapper for fixBatchedJobsWithoutBatch that matches expected return type
    const fixBatchedJobsWrapper = async () => {
      await hookResult.fixBatchedJobsWithoutBatch();
      // Return type is void as expected
    };
    
    // Add a specialized wrapper for createBatch to handle sticker-specific logic
    const createBatchWrapper = async (selectedJobs, batchProperties) => {
      console.log("Creating sticker batch with properties:", batchProperties);
      console.log("Selected jobs:", selectedJobs);
      
      try {
        // Make sure lamination type is properly set for stickers
        const enhancedProperties = {
          ...batchProperties,
          laminationType: batchProperties.laminationType || "none"
        };
        
        const result = await hookResult.createBatch(selectedJobs, enhancedProperties);
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
