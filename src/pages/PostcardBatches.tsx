
import { useSearchParams } from "react-router-dom";
import { usePostcardBatches } from "@/hooks/usePostcardBatches";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import BatchesWrapper from "@/components/batches/business-cards/BatchesWrapper";
import { BatchSummary } from "@/components/batches/types/BatchTypes";
import BatchDeleteDialog from "@/components/batches/flyers/BatchDeleteDialog";
import JobsHeader from "@/components/business-cards/JobsHeader";
import BatchDetails from "@/components/batches/BatchDetails";

const PostcardBatches = () => {
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get('batchId');
  
  const {
    batches,
    isLoading,
    error,
    batchToDelete,
    isDeleting,
    fetchBatches,
    handleViewPDF,
    handleDeleteBatch,
    handleViewBatchDetails,
    setBatchToDelete
  } = usePostcardBatches(batchId);

  // Convert PostcardBatch[] to BatchSummary[] for BatchesWrapper
  const batchSummaries: BatchSummary[] = batches.map(batch => ({
    id: batch.id,
    name: batch.name,
    due_date: batch.due_date,
    status: batch.status,
    product_type: "Postcards",
    sheets_required: batch.sheets_required,
    lamination_type: batch.lamination_type,
    front_pdf_url: batch.front_pdf_url,
    back_pdf_url: batch.back_pdf_url,
    created_at: batch.created_at
  }));

  // If we're viewing a specific batch, use the BatchDetails component
  if (batchId) {
    return (
      <BatchDetails 
        batchId={batchId} 
        productType="Postcards"
        backUrl="/batches/postcards/batches"
      />
    );
  }

  return (
    <div>
      <JobsHeader 
        title="Postcard Batches" 
        subtitle="View and manage all your postcard batches" 
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
        onDeleteBatch={setBatchToDelete}
        onViewDetails={handleViewBatchDetails}
      />

      {/* Delete Confirmation Dialog */}
      <BatchDeleteDialog 
        isOpen={!!batchToDelete}
        isDeleting={isDeleting}
        onClose={() => setBatchToDelete(null)}
        onConfirmDelete={handleDeleteBatch}
      />
    </div>
  );
};

export default PostcardBatches;
