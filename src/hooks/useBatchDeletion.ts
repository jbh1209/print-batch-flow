
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
    if (!batchToDelete) return;
    
    setIsDeleting(true);
    
    try {
      const result = await BatchDeletionService.deleteBatch(
        batchToDelete, 
        productType,
        onSuccess
      );
      
      if (result.success) {
        setBatchToDelete(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const initiateDeletion = (batchId: string) => {
    setBatchToDelete(batchId);
  };

  const cancelDeletion = () => {
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
