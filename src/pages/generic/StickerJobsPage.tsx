
import { productConfigs } from "@/config/productTypes";
import { useGenericJobs } from "@/hooks/generic/useGenericJobs";
import GenericJobsPage from "@/components/generic/GenericJobsPage";
import { useEffect } from "react";
import { isExistingTable } from "@/utils/database/tableValidation";
import { toast } from "sonner";
import { BaseJob } from "@/config/types/baseTypes";

const StickerJobsPage = () => {
  const config = productConfigs["Stickers"];
  
  // Validate the config on component mount
  useEffect(() => {
    console.log("Stickers config loaded:", config);
    
    if (!config) {
      console.error("No configuration found for Stickers");
      toast.error("Configuration error: Missing stickers configuration");
      return;
    }
    
    if (!config.tableName) {
      console.error("No table name defined for Stickers config");
      toast.error("Configuration error: Missing stickers table name");
      return;
    }
    
    const isValid = isExistingTable(config.tableName);
    console.log(`Table name "${config.tableName}" is ${isValid ? 'valid' : 'invalid'}`);
    
    if (!isValid) {
      toast.error(`Invalid table configuration for Stickers`);
    }
    
    console.log("Available paper types for stickers:", config.availablePaperTypes);
    console.log("Available lamination types for stickers:", config.availableLaminationTypes);
  }, []);
  
  // Create a wrapper function that returns the hook result with type conversion
  const jobsHookWrapper = () => {
    const hookResult = useGenericJobs(config);
    
    // Ensure fixBatchedJobsWithoutBatch returns a number as expected
    const fixBatchedJobsWrapper = async (): Promise<number> => {
      return await hookResult.fixBatchedJobsWithoutBatch();
    };
    
    // Add a specialized wrapper for createBatch to handle sticker-specific logic
    const createBatchWrapper = async (selectedJobs: BaseJob[], batchProperties: any): Promise<any> => {
      console.log("Creating sticker batch with properties:", batchProperties);
      console.log("Selected jobs:", selectedJobs);
      
      try {
        // Make sure lamination type is properly set for stickers
        const enhancedProperties = {
          ...batchProperties,
          laminationType: batchProperties.laminationType || "none",
          // Ensure the product type is correctly set
          productType: "Stickers"
        };
        
        const result = await hookResult.createBatch(selectedJobs, enhancedProperties);
        console.log("Sticker batch creation result:", result);
        return result;
      } catch (err) {
        console.error("Error in sticker batch creation:", err);
        toast.error("Failed to create sticker batch");
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
