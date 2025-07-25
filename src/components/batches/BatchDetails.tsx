
import { useState } from "react";
import { useFetchBatchDetails } from "@/hooks/batches/useFetchBatchDetails";
import BatchDetailsHeader from "./BatchDetailsHeader";
import BatchDetailsContent from "./BatchDetailsContent";
import BatchDetailsLoading from "./BatchDetailsLoading";
import BatchNotFound from "./BatchNotFound";
import { StandardDeleteBatchDialog } from "./StandardDeleteBatchDialog";
import { useBatchDeletion } from "@/hooks/useBatchDeletion";

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
  } = useFetchBatchDetails({ batchId, productType, backUrl });

  const {
    batchToDelete,
    isDeleting,
    initiateDeletion,
    cancelDeletion,
    handleDeleteBatch
  } = useBatchDeletion({
    productType,
    onSuccess: fetchBatchDetails
  });

  return (
    <div>
      <BatchDetailsHeader backUrl={backUrl} error={error} />

      {isLoading ? (
        <BatchDetailsLoading />
      ) : !batch ? (
        <BatchNotFound backUrl={backUrl} />
      ) : (
        <>
          <BatchDetailsContent
            batch={batch}
            relatedJobs={relatedJobs}
            productType={productType}
            onDeleteClick={() => initiateDeletion(batch.id)}
            onRefresh={fetchBatchDetails}
          />

          {/* Standardized Delete Confirmation Dialog */}
          <StandardDeleteBatchDialog
            isOpen={!!batchToDelete}
            isDeleting={isDeleting}
            batchName={batch?.name}
            onCancel={cancelDeletion}
            onConfirm={handleDeleteBatch}
          />
        </>
      )}
    </div>
  );
};

export default BatchDetails;
