
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { BaseBatch, ProductConfig, BaseJob } from "@/config/productTypes";
import { useGenericBatch } from "./useGenericBatch";
import { ensureValidBatchesArray } from "@/utils/validation/typeGuards";
import { toast } from "sonner";

export interface StandardBatchHookOptions {
  filterByCurrentUser?: boolean;
  includeRelatedJobs?: boolean;
  validateData?: boolean;
}

export interface StandardBatchHookResult {
  batches: BaseBatch[];
  isLoading: boolean;
  error: string | null;
  batchToDelete: string | null;
  isDeleting: boolean;
  fetchBatches: () => Promise<void>;
  handleViewPDF: (url: string | null) => void;
  handleDeleteBatch: () => Promise<void>;
  handleViewBatchDetails: (id: string) => void;
  setBatchToDelete: (id: string | null) => void;
  relatedJobs?: BaseJob[];
}

/**
 * Standardized hook for batch operations with consistent return structure
 * and built-in type validation
 */
export function useStandardBatch(
  config: ProductConfig,
  batchId: string | null = null, 
  options: StandardBatchHookOptions = {}
): StandardBatchHookResult {
  const { user } = useAuth();
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // Default options
  const {
    filterByCurrentUser = false,
    includeRelatedJobs = false,
    validateData = true
  } = options;
  
  // Use the base generic batch hook
  const {
    batches: rawBatches,
    isLoading,
    error: baseError,
    batchToDelete,
    isDeleting,
    fetchBatches: baseFetchBatches,
    handleViewPDF,
    handleDeleteBatch,
    handleViewBatchDetails,
    setBatchToDelete
  } = useGenericBatch(config, batchId);
  
  // Validate batches data if required
  const batches = validateData 
    ? ensureValidBatchesArray(rawBatches)
    : rawBatches as BaseBatch[];
  
  // Combine errors
  const error = validationErrors.length > 0
    ? `${baseError || ''} ${validationErrors.join(', ')}`
    : baseError;
  
  // Wrap the fetch function to add validation
  const fetchBatches = async () => {
    setValidationErrors([]);
    try {
      await baseFetchBatches();
    } catch (err) {
      console.error("Error fetching batches:", err);
      setValidationErrors([`Fetch error: ${err instanceof Error ? err.message : String(err)}`]);
      toast.error("Error loading batch data");
    }
  };
  
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
