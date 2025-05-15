
import { useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useFlyerBatches } from "@/hooks/useFlyerBatches";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import FlyerBatchDetails from "@/pages/FlyerBatchDetails";
import BatchesWrapper from "@/components/batches/business-cards/BatchesWrapper";
import { BatchesHeader } from "./components/batches/BatchesHeader";
import { BatchesErrorAlert } from "./components/batches/BatchesErrorAlert";
import BatchDeleteDialog from "@/components/flyers/batch-details/DeleteBatchDialog";

const FlyerBatches = () => {
  // Change from using searchParams to useParams hook
  const { batchId } = useParams();
  
  const {
    batches,
    isLoading,
    error,
    batchToDelete,
    isDeleting,
    fetchBatches,
    handleViewPDF,
    handleViewBatchDetails,
    handleDeleteBatch,
    setBatchToDelete
  } = useFlyerBatches(batchId || null);

  // Convert FlyerBatch[] to BatchSummary[] for BatchesWrapper
  const batchSummaries = batches.map(batch => ({
    id: batch.id,
    name: batch.name,
    due_date: batch.due_date,
    status: batch.status,
    product_type: "Flyers",
    sheets_required: batch.sheets_required,
    lamination_type: batch.lamination_type,
    front_pdf_url: batch.front_pdf_url,
    back_pdf_url: batch.back_pdf_url,
    overview_pdf_url: batch.overview_pdf_url || null,
    created_at: batch.created_at
  }));

  // If we're viewing a specific batch, render the BatchDetails component
  if (batchId) {
    return <FlyerBatchDetails />;
  }

  return (
    <div>
      <BatchesHeader />

      {/* Error message if there's an issue fetching data */}
      {error && !isLoading && (
        <BatchesErrorAlert error={error} onRetry={fetchBatches} />
      )}

      <BatchesWrapper 
        batches={batchSummaries}
        isLoading={isLoading}
        error={error}
        onRefresh={fetchBatches}
        onViewPDF={handleViewPDF}
        onViewDetails={handleViewBatchDetails}
        onDeleteBatch={setBatchToDelete}
      />

      {/* Delete Confirmation Dialog */}
      <BatchDeleteDialog 
        isOpen={!!batchToDelete}
        isDeleting={isDeleting}
        onClose={() => setBatchToDelete(null)}
        onConfirm={handleDeleteBatch}
      />
    </div>
  );
};

export default FlyerBatches;
