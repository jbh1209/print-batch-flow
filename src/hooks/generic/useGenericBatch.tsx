
import { BaseBatch, ProductConfig, BaseJob } from "@/config/productTypes";
import { useBatchFetching } from "./batch-operations/useBatchFetching";
import { useBatchDeletion } from "./batch-operations/useBatchDeletion";
import { useBatchNavigation } from "./batch-operations/useBatchNavigation";
import { toast } from "sonner";

export function useGenericBatch(
  config: ProductConfig, 
  batchId: string | null = null
) {
  // Use our dedicated hooks to split functionality and avoid circular type references
  const { batches, isLoading, error, fetchBatches } = useBatchFetching(config, batchId);
  const { batchToDelete, isDeleting, setBatchToDelete, handleDeleteBatch } = 
    useBatchDeletion(config.tableName, fetchBatches);
  const { handleViewPDF, handleViewBatchDetails } = useBatchNavigation(config.productType);
  
  return {
    batches,
    isLoading,
    error,
    batchToDelete,
    isDeleting,
    fetchBatches,
    handleViewPDF,
    handleDeleteBatch,
    handleViewBatchDetails,
    setBatchToDelete
  };
}
