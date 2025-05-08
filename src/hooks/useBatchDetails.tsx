
import { useFetchBatchDetails } from "./batches/useFetchBatchDetails";
import { useDeleteBatch } from "./batches/useDeleteBatch";

interface UseBatchDetailsProps {
  batchId: string;
  productType: string;
  backUrl: string;
}

export function useBatchDetails({ batchId, productType, backUrl }: UseBatchDetailsProps) {
  const {
    batch,
    jobs: relatedJobs,
    isLoading,
    error,
    fetchBatchDetails
  } = useFetchBatchDetails({ batchId, productType, backUrl });

  const {
    batchToDelete,
    isDeleting,
    setBatchToDelete,
    handleDeleteBatch
  } = useDeleteBatch({ productType, backUrl });

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
