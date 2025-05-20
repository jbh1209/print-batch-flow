
import { BaseBatch, ProductConfig, BaseJob, LaminationType, ExistingTableName } from "@/config/productTypes";
import { useBatchFetching } from "./batch-operations/useBatchFetching";
import { useBatchDeletion } from "./batch-operations/useBatchDeletion";
import { useBatchNavigation } from "./batch-operations/useBatchNavigation";
import { useBatchCreation, BatchCreationResult } from "./batch-operations/useBatchCreation";
import { toast } from "sonner";
import { isExistingTable } from "@/utils/database/tableValidation";
import { BatchCreationConfig } from "./batch-operations/types/batchCreationTypes";

export function useGenericBatches<T extends BaseJob = BaseJob>(
  config: ProductConfig, 
  batchId: string | null = null
) {
  // Validate table name before proceeding
  if (!isExistingTable(config.tableName)) {
    console.error(`Invalid table name in config: ${config.tableName}`);
    // Still continue so we don't break the app, but log the error
  }

  // Use the table name only after validation
  const validTableName = isExistingTable(config.tableName) ? config.tableName : null;
  
  // Pass batchId to useBatchFetching without filtering by user
  const { batches, isLoading, error, fetchBatches } = useBatchFetching(config, batchId);
  const { batchToDelete, isDeleting, setBatchToDelete, handleDeleteBatch } = 
    useBatchDeletion(validTableName as ExistingTableName, fetchBatches);
  const { handleViewPDF, handleViewBatchDetails } = useBatchNavigation(config.productType);
  const { createBatchWithSelectedJobs, isCreatingBatch } = 
    useBatchCreation(config.productType, validTableName || "");

  // Wrapper function with the same signature as before to maintain compatibility
  const wrappedCreateBatch = async (
    selectedJobs: BaseJob[], 
    configOptions: BatchCreationConfig
  ): Promise<BatchCreationResult> => {
    if (selectedJobs.length === 0) {
      toast.error("No jobs selected for batch creation");
      return { success: false, batchId: null, error: "No jobs selected", jobsUpdated: 0 };
    }
    
    if (!validTableName) {
      toast.error(`Invalid table configuration for ${config.productType}`);
      return { success: false, batchId: null, error: `Invalid table configuration for ${config.productType}`, jobsUpdated: 0 };
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
    
    // Call the underlying function with the extracted parameters and return the BatchCreationResult
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
