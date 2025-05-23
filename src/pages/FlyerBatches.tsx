
import { useFlyerBatches } from "@/hooks/useFlyerBatches";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useParams, Navigate } from "react-router-dom";
import FlyerBatchDetails from "./FlyerBatchDetails";
import BatchesWrapper from "@/components/batches/business-cards/BatchesWrapper";
import { BatchSummary } from "@/components/batches/types/BatchTypes";
import { BatchDeleteConfirmation } from "@/components/generic/batch-list/BatchDeleteConfirmation";
import JobsHeader from "@/components/business-cards/JobsHeader";
import { useBatchOperations } from "@/context/BatchOperationsContext";

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
    batchBeingDeleted,
    isDeletingBatch,
    deleteBatch,
    setBatchBeingDeleted
  } = useBatchOperations();

  // Handler for batch deletion
  const handleDeleteBatch = async () => {
    if (!batchBeingDeleted) return;
    
    const success = await deleteBatch(
      batchBeingDeleted,
      "Flyers",
      "/batches/flyers/batches"
    );
    
    if (success) {
      // Refresh the batches list
      fetchBatches();
    }
  };

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
        onDeleteBatch={setBatchBeingDeleted}
        onViewDetails={handleViewBatchDetails}
      />

      {/* Delete Confirmation Dialog */}
      <BatchDeleteConfirmation 
        batchToDelete={batchBeingDeleted}
        onCancel={() => setBatchBeingDeleted(null)}
        onDelete={handleDeleteBatch}
        batchName={batches.find(b => b.id === batchBeingDeleted)?.name}
      />
    </div>
  );
};

export default FlyerBatches;
