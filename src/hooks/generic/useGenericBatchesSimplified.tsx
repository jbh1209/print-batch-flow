/**
 * SIMPLIFIED GENERIC BATCHES HOOK
 * 
 * Replaces the complex useGenericBatches with a simple unified system.
 * Uses the new unified batch creation system for all product types.
 */

import { BaseJob, ProductConfig } from "@/config/productTypes";
import { useUnifiedBatchCreation } from "@/hooks/useUnifiedBatchCreation";
import { useBatchFetching } from "./batch-operations/useBatchFetching";
import { useBatchDeletion } from "./batch-operations/useBatchDeletion";
import { useBatchNavigation } from "./batch-operations/useBatchNavigation";
import { toast } from "sonner";

export function useGenericBatches<T extends BaseJob = BaseJob>(
  config: ProductConfig, 
  batchId: string | null = null
) {
  // Keep existing batch management functionality
  const { batches, isLoading, error, fetchBatches } = useBatchFetching(config, batchId);
  const { batchToDelete, isDeleting, setBatchToDelete, handleDeleteBatch } = 
    useBatchDeletion(config.tableName, fetchBatches);
  const { handleViewPDF, handleViewBatchDetails } = useBatchNavigation(config.productType);
  
  // Use the new unified batch creation system
  const { createBatch, isCreatingBatch, generateBatchName } = useUnifiedBatchCreation();

  const createBatchWithSelectedJobs = async (
    selectedJobs: BaseJob[], 
    configOptions: ProductConfig & { 
      laminationType?: string,
      slaTargetDays?: number,
      paperType?: string,
      paperWeight?: string
    }
  ) => {
    if (selectedJobs.length === 0) {
      toast.error("No jobs selected for batch creation");
      return null;
    }
    
    if (!config.tableName) {
      toast.error(`Invalid table configuration for ${config.productType}`);
      return null;
    }
    
    console.log(`🔄 Creating batch for ${config.productType} with ${selectedJobs.length} jobs`);
    
    const batchConfig = {
      productType: config.productType,
      tableName: config.tableName,
      laminationType: configOptions.laminationType,
      paperType: configOptions.paperType,
      paperWeight: configOptions.paperWeight,
      slaTargetDays: configOptions.slaTargetDays || config.slaTargetDays
    };
    
    return await createBatch(selectedJobs, batchConfig);
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
    createBatchWithSelectedJobs,
    generateBatchName
  };
}
