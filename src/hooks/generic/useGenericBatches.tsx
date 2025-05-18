
import { BaseBatch, ProductConfig, BaseJob, LaminationType, ExistingTableName } from "@/config/productTypes";
import { useBatchFetching } from "./batch-operations/useBatchFetching";
import { useBatchDeletion } from "./batch-operations/useBatchDeletion";
import { useBatchNavigation } from "./batch-operations/useBatchNavigation";
import { useBatchCreation } from "./batch-operations/useBatchCreation";
import { toast } from "sonner";
import { isExistingTable } from "@/utils/database/tableValidation";

export function useGenericBatches<T extends BaseJob = BaseJob>(
  config: ProductConfig, 
  batchId: string | null = null,
  options = { filterByCurrentUser: false }
) {
  // Validate table name before proceeding
  if (!isExistingTable(config.tableName)) {
    console.error(`Invalid table name in config: ${config.tableName}`);
    // Still continue so we don't break the app, but log the error
  }

  // Use the table name only after validation
  const validTableName = isExistingTable(config.tableName) ? config.tableName : null;
  
  // Use our updated useBatchFetching hook with the filterByCurrentUser option
  const { batches, isLoading, error, fetchBatches } = useBatchFetching(
    config, 
    batchId,
    { filterByCurrentUser: options.filterByCurrentUser }
  );
  
  const { batchToDelete, isDeleting, setBatchToDelete, handleDeleteBatch } = 
    useBatchDeletion(validTableName, fetchBatches);
  const { handleViewPDF, handleViewBatchDetails } = useBatchNavigation(config.productType);
  const { createBatchWithSelectedJobs, isCreatingBatch } = 
    useBatchCreation(config.productType, validTableName || "");

  // Wrapper function with the same signature as before to maintain compatibility
  const wrappedCreateBatch = async (
    selectedJobs: BaseJob[], 
    configOptions: ProductConfig & { 
      laminationType?: LaminationType,
      slaTargetDays?: number,
      paperType?: string,
      paperWeight?: string
    }
  ) => {
    if (selectedJobs.length === 0) {
      toast.error("No jobs selected for batch creation");
      return null;
    }
    
    if (!validTableName) {
      toast.error(`Invalid table configuration for ${config.productType}`);
      return null;
    }
    
    console.log("Creating batch with jobs:", selectedJobs);
    console.log("Using config options:", configOptions);
    
    // Extract parameters from configOptions
    const { laminationType, slaTargetDays, paperType, paperWeight } = configOptions;
    
    // Make sure first job has a valid paper type for validation
    if (selectedJobs.length > 0 && paperType && !selectedJobs[0].paper_type) {
      selectedJobs[0] = {
        ...selectedJobs[0],
        paper_type: paperType
      };
    }
    
    // Call the underlying function with the extracted parameters
    return createBatchWithSelectedJobs(
      selectedJobs, 
      { ...config, ...configOptions },
      laminationType || "none",
      slaTargetDays
    );
  };

  return {
    batches,
    isLoading,
    error,
    batchToDelete,
    isDeleting,
    isCreatingBatch,
    fetchBatches,
    handleViewPDF,
    handleDeleteBatch,
    handleViewBatchDetails,
    setBatchToDelete,
    createBatchWithSelectedJobs: wrappedCreateBatch
  };
}
