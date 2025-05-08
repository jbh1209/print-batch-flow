
import { BaseBatch, ProductConfig, BaseJob } from "@/config/productTypes";
import { useBatchFetching } from "./batch-operations/useBatchFetching";
import { useBatchDeletion } from "./batch-operations/useBatchDeletion";
import { useBatchNavigation } from "./batch-operations/useBatchNavigation";
import { toast } from "sonner";
import { isExistingTable } from "@/utils/database/tableValidation";
import { ExistingTableName } from "@/config/types/baseTypes";

export function useGenericBatch(
  config: ProductConfig, 
  batchId: string | null = null
) {
  // Validate table name before use
  const validTableName = isExistingTable(config.tableName) ? config.tableName : null;
  
  // Use our dedicated hooks to split functionality and avoid circular type references
  const { batches, isLoading, error, fetchBatches } = useBatchFetching(config, batchId);
  const { batchToDelete, isDeleting, setBatchToDelete, handleDeleteBatch } = 
    useBatchDeletion(validTableName, fetchBatches);
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
