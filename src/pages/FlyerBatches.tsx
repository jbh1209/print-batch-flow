
import { useFlyerBatches } from "@/hooks/useFlyerBatches";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useParams, Navigate } from "react-router-dom";
import FlyerBatchDetails from "./FlyerBatchDetails";
import BatchesWrapper from "@/components/batches/business-cards/BatchesWrapper";
import { BatchSummary } from "@/components/batches/types/BatchTypes";
import { StandardDeleteBatchDialog } from "@/components/batches/StandardDeleteBatchDialog";
import JobsHeader from "@/components/business-cards/JobsHeader";
import { useBatchDeletion } from "@/hooks/useBatchDeletion";
import { LaminationType } from "@/components/batches/types/FlyerTypes";

const FlyerBatches = () => {
  const { batchId } = useParams();
  
  // If batchId is present, redirect to the proper route
  if (batchId) {
    return <Navigate to={`/batches/flyers/batches/${batchId}`} replace />;
  }
  
  const {
    batches,
    isLoading,
    error,
    fetchBatches,
    handleViewPDF,
    handleViewBatchDetails
  } = useFlyerBatches();

  const {
    batchToDelete,
    isDeleting,
    handleDeleteBatch,
    initiateDeletion,
    cancelDeletion
  } = useBatchDeletion({
    productType: "Flyers",
    onSuccess: fetchBatches // Refresh the list after successful deletion
  });

  // Convert FlyerBatch[] to BatchSummary[] for BatchesWrapper
  const batchSummaries: BatchSummary[] = batches.map(batch => ({
    id: batch.id,
    name: batch.name,
    due_date: batch.due_date,
    status: batch.status,
    product_type: "Flyers",
    sheets_required: batch.sheets_required,
    lamination_type: (batch.lamination_type || 'none') as LaminationType,
    front_pdf_url: batch.front_pdf_url,
    back_pdf_url: batch.back_pdf_url,
    created_at: batch.created_at
  }));

  // Find the batch name for the dialog
  const batchToDeleteName = batchToDelete 
    ? batches.find(b => b.id === batchToDelete)?.name 
    : undefined;

  return (
    <div>
      <JobsHeader 
        title="Flyer Batches" 
        subtitle="View and manage all your flyer batches" 
      />

      {/* Error message if there's an issue fetching data */}
      {error && !isLoading && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading batches</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchBatches}
              >
                Try Again
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <BatchesWrapper 
        batches={batchSummaries}
        isLoading={isLoading}
        error={error}
        onRefresh={fetchBatches}
        onViewPDF={handleViewPDF}
        onDeleteBatch={initiateDeletion}
        onViewDetails={handleViewBatchDetails}
      />

      {/* Standardized Delete Confirmation Dialog */}
      <StandardDeleteBatchDialog
        isOpen={!!batchToDelete}
        isDeleting={isDeleting}
        batchName={batchToDeleteName}
        onCancel={cancelDeletion}
        onConfirm={handleDeleteBatch}
      />
    </div>
  );
};

export default FlyerBatches;
