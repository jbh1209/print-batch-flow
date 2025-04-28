
import { BaseBatch, ProductConfig, BaseJob, LaminationType } from "@/config/productTypes";
import { useBatchFetching } from "./batch-operations/useBatchFetching";
import { useBatchDeletion } from "./batch-operations/useBatchDeletion";
import { useBatchNavigation } from "./batch-operations/useBatchNavigation";
import { useBatchCreation } from "./batch-operations/useBatchCreation";

export function useGenericBatches<T extends BaseJob = BaseJob>(
  config: ProductConfig, 
  batchId: string | null = null
) {
  const { batches, isLoading, error, fetchBatches } = useBatchFetching(config, batchId);
  const { batchToDelete, isDeleting, setBatchToDelete, handleDeleteBatch } = useBatchDeletion(config.tableName, fetchBatches);
  const { handleViewPDF, handleViewBatchDetails } = useBatchNavigation(config.productType);
  const { createBatchWithSelectedJobs, isCreatingBatch } = useBatchCreation(config.productType, config.tableName);

  // Wrapper function with the same signature as before to maintain compatibility
  const wrappedCreateBatch = async (
    selectedJobs: T[],
    configOptions: ProductConfig & { 
      laminationType?: LaminationType,
      slaTargetDays?: number  // Add slaTargetDays as an optional property
    }
  ) => {
    // Extract laminationType and slaTargetDays from configOptions
    const { laminationType, slaTargetDays, ...restConfig } = configOptions as any;
    
    // Call the underlying function with the separate laminationType parameter
    return createBatchWithSelectedJobs(
      selectedJobs,
      { ...config, ...restConfig },
      laminationType || "none",
      slaTargetDays || config.slaTargetDays || 3 // Use provided value, or default from config
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
