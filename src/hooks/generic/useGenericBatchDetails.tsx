
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ProductConfig } from "@/config/productTypes";
import { useBatchDataFetching } from "@/hooks/batches/useBatchDataFetching";
import { useBatchDeletion } from "@/hooks/batches/useBatchDeletion";

interface UseGenericBatchDetailsProps {
  batchId: string;
  config: ProductConfig;
}

export function useGenericBatchDetails({ batchId, config }: UseGenericBatchDetailsProps) {
  const { user } = useAuth();
  
  const {
    batch,
    relatedJobs,
    isLoading,
    error,
    fetchBatchDetails
  } = useBatchDataFetching({ 
    batchId, 
    config, 
    userId: user?.id 
  });

  const {
    batchToDelete,
    isDeleting,
    setBatchToDelete,
    handleDeleteBatch
  } = useBatchDeletion({ config });

  useEffect(() => {
    if (batchId && user) {
      console.log("Initiating batch details fetch for:", batchId);
      fetchBatchDetails();
    } else if (!user) {
      console.log("No authenticated user for batch details");
    } else if (!batchId) {
      console.log("No batchId provided for batch details");
    }
  }, [batchId, user]);

  return {
    batch,
    relatedJobs,
    isLoading,
    error,
    batchToDelete,
    isDeleting,
    setBatchToDelete,
    handleDeleteBatch,
    fetchBatchDetails
  };
}
