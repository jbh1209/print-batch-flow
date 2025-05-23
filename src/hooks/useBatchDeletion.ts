
import { useState } from "react";
import { BatchDeletionService } from "@/services/BatchDeletionService";

interface UseBatchDeletionProps {
  productType: string;
  onSuccess?: () => void;
}

export function useBatchDeletion({ productType, onSuccess }: UseBatchDeletionProps) {
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteBatch = async () => {
    if (!batchToDelete) {
      console.error("[useBatchDeletion] No batch selected for deletion");
      return;
    }
    
    console.log(`[useBatchDeletion] Starting deletion process for batch: ${batchToDelete}`);
    setIsDeleting(true);
    
    try {
      const result = await BatchDeletionService.deleteBatch(
        batchToDelete, 
        productType,
        onSuccess
      );
      
      if (result.success) {
        console.log(`[useBatchDeletion] Batch deletion successful`);
        setBatchToDelete(null);
      } else {
        console.error(`[useBatchDeletion] Batch deletion failed:`, result.error);
      }
    } catch (error) {
      console.error(`[useBatchDeletion] Unexpected error during deletion:`, error);
    } finally {
      setIsDeleting(false);
    }
  };

  const initiateDeletion = (batchId: string) => {
    console.log(`[useBatchDeletion] Initiating deletion for batch: ${batchId}`);
    setBatchToDelete(batchId);
  };

  const cancelDeletion = () => {
    console.log(`[useBatchDeletion] Cancelling deletion`);
    setBatchToDelete(null);
  };

  return {
    batchToDelete,
    isDeleting,
    handleDeleteBatch,
    initiateDeletion,
    cancelDeletion
  };
}
