
import { useState } from "react";
import { useBatchDetails } from "@/hooks/useBatchDetails";
import BatchDetailsHeader from "./BatchDetailsHeader";
import BatchDetailsContent from "./BatchDetailsContent";
import BatchDetailsLoading from "./BatchDetailsLoading";
import BatchNotFound from "./BatchNotFound";
import DeleteBatchDialog from "./DeleteBatchDialog";

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
    batchToDelete,
    isDeleting,
    setBatchToDelete,
    handleDeleteBatch
  } = useBatchDetails({ batchId, productType, backUrl });

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
            onDeleteClick={() => setBatchToDelete(batch.id)}
          />

          {/* Delete Confirmation Dialog */}
          <DeleteBatchDialog 
            isOpen={!!batchToDelete}
            isDeleting={isDeleting}
            batchName={batch?.name || ""}
            onClose={() => setBatchToDelete(null)}
            onConfirmDelete={handleDeleteBatch}
          />
        </>
      )}
    </div>
  );
};

export default BatchDetails;
