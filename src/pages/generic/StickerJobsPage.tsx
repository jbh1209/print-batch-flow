
import { productConfigs } from "@/config/productTypes";
import { useGenericJobs } from "@/hooks/generic/useGenericJobs";
import GenericJobsPage from "@/components/generic/GenericJobsPage";
import { useEffect } from "react";
import { isExistingTable } from "@/utils/database/tableValidation";
import { toast } from "sonner";

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
    
    return hookResult;
  };

  return <GenericJobsPage config={config} useJobsHook={jobsHookWrapper} />;
};

export default StickerJobsPage;
