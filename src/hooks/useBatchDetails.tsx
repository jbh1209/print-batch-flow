
import { useFetchBatchDetails } from "./batches/useFetchBatchDetails";

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

  return {
    batch,
    relatedJobs,
    isLoading,
    error,
    fetchBatchDetails
  };
}
