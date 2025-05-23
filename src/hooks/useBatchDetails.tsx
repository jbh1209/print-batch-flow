
import { useFetchBatchDetails } from "./batches/useFetchBatchDetails";
import { useBatchDeletion } from "./useBatchDeletion";

interface UseBatchDetailsProps {
  batchId: string;
  productType: string;
  backUrl: string;
}

export function useBatchDetails({ batchId, productType, backUrl }: UseBatchDetailsProps) {
  const {
    batch,
    relatedJobs,
    isLoading,
    error,
    fetchBatchDetails
  } = useFetchBatchDetails({ batchId, productType, backUrl });

  const {
    batchToDelete,
    isDeleting,
    handleDeleteBatch,
    initiateDeletion,
    cancelDeletion
  } = useBatchDeletion({ 
    productType,
    onSuccess: () => {
      // Refresh the batch details after successful deletion
      fetchBatchDetails();
    }
  });

  return {
    batch,
    relatedJobs,
    isLoading,
    error,
    batchToDelete,
    isDeleting,
    setBatchToDelete: initiateDeletion,
    handleDeleteBatch,
    fetchBatchDetails
  };
}
