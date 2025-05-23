
import { useBatchDetails } from "@/hooks/useBatchDetails";
import BatchDetailsContent from "./BatchDetailsContent";
import { BatchDeleteConfirmation } from "@/components/generic/batch-list/BatchDeleteConfirmation";
import BatchDetailsLoading from "./BatchDetailsLoading";
import BatchNotFound from "./BatchNotFound";
import BatchDetailsHeader from "./BatchDetailsHeader";
import { useBatchOperations } from "@/context/BatchOperationsContext";

interface BatchDetailsProps {
  batchId: string;
  productType: string;
  backUrl: string;
}

const BatchDetails = ({ batchId, productType, backUrl }: BatchDetailsProps) => {
  const {
    batch,
    relatedJobs,
    isLoading,
    error,
    fetchBatchDetails
  } = useBatchDetails({ batchId, productType, backUrl });
  
  const {
    batchBeingDeleted,
    isDeletingBatch,
    deleteBatch,
    setBatchBeingDeleted
  } = useBatchOperations();

  const handleDeleteBatch = async () => {
    if (!batchBeingDeleted) return;
    
    await deleteBatch(
      batchBeingDeleted,
      productType,
      backUrl
    );
  };

  if (isLoading) {
    return <BatchDetailsLoading />;
  }

  if (error || !batch) {
    return <BatchNotFound backUrl={backUrl} />;
  }

  return (
    <div>
      <BatchDetailsHeader 
        backUrl={backUrl}
        error={null}
        batchName={batch.name}
        productType={productType}
      />
      
      <BatchDetailsContent
        batch={batch}
        relatedJobs={relatedJobs}
        productType={productType}
        onDeleteClick={() => setBatchBeingDeleted(batch.id)}
      />

      <BatchDeleteConfirmation
        batchToDelete={batchBeingDeleted}
        onCancel={() => setBatchBeingDeleted(null)}
        onDelete={handleDeleteBatch}
        batchName={batch.name}
      />
    </div>
  );
};

export default BatchDetails;
