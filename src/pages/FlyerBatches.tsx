
import { useSearchParams } from "react-router-dom";
import { useFlyerBatches } from "@/hooks/useFlyerBatches";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import FlyerBatchDetails from "./FlyerBatchDetails";
import BatchesWrapper from "@/components/batches/business-cards/BatchesWrapper";
import { BatchSummary } from "@/components/batches/types/BatchTypes";
import BatchDeleteDialog from "@/components/batches/flyers/BatchDeleteDialog";
import JobsHeader from "@/components/business-cards/JobsHeader";

const FlyerBatches = () => {
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
  } = useFlyerBatches(batchId);

  // Convert FlyerBatch[] to BatchSummary[] for BatchesWrapper
  const batchSummaries: BatchSummary[] = batches.map(batch => ({
    id: batch.id,
    name: batch.name,
    due_date: batch.due_date,
    status: batch.status,
    product_type: "Flyers",
    sheets_required: batch.sheets_required,
    lamination_type: batch.lamination_type,
    front_pdf_url: batch.front_pdf_url,
    back_pdf_url: batch.back_pdf_url,
    created_at: batch.created_at
  }));

  // If we're viewing a specific batch, render the BatchDetails component
  if (batchId) {
    return <FlyerBatchDetails />;
  }

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

export default FlyerBatches;
