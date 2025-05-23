
import { useSearchParams } from "react-router-dom";
import { useBusinessCardBatches } from "@/hooks/useBusinessCardBatches";
import JobsHeader from "@/components/business-cards/JobsHeader";
import BatchDetails from "@/components/batches/BatchDetails";
import BatchesWrapper from "@/components/batches/business-cards/BatchesWrapper";
import { StandardDeleteBatchDialog } from "@/components/batches/StandardDeleteBatchDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BatchSummary } from "@/components/batches/types/BatchTypes";
import { useBatchDeletion } from "@/hooks/useBatchDeletion";

const BusinessCardBatches = () => {
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get('batchId');
  
  const {
    batches,
    isLoading,
    error,
    fetchBatches,
    handleViewPDF,
    handleViewBatchDetails
  } = useBusinessCardBatches(batchId);

  // Use the new standardized batch deletion hook
  const {
    batchToDelete,
    isDeleting,
    handleDeleteBatch,
    initiateDeletion,
    cancelDeletion
  } = useBatchDeletion({
    productType: "Business Cards",
    onSuccess: fetchBatches // Refresh the list after successful deletion
  });

  // Convert Batch[] to BatchSummary[] for BatchesWrapper
  const batchSummaries: BatchSummary[] = batches.map(batch => ({
    id: batch.id,
    name: batch.name,
    due_date: batch.due_date,
    status: batch.status,
    product_type: "Business Cards",
    sheets_required: batch.sheets_required,
    lamination_type: batch.lamination_type,
    front_pdf_url: batch.front_pdf_url,
    back_pdf_url: batch.back_pdf_url,
    created_at: batch.created_at
  }));

  // Find the batch name for the dialog
  const batchToDeleteName = batchToDelete 
    ? batches.find(b => b.id === batchToDelete)?.name 
    : undefined;

  // If we're viewing a specific batch, render the BatchDetails component
  if (batchId) {
    return (
      <BatchDetails 
        batchId={batchId} 
        productType="Business Cards" 
        backUrl="/batches/business-cards/batches" 
      />
    );
  }

  return (
    <div>
      <JobsHeader 
        title="Business Card Batches" 
        subtitle="View and manage all your business card batches" 
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

export default BusinessCardBatches;
