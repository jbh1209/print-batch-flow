
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useProductPageBatches } from "@/hooks/product-pages/useProductPageBatches";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProductPageBatchDetails from "./ProductPageBatchDetailsPage";
import BatchesWrapper from "@/components/batches/business-cards/BatchesWrapper";

export default function ProductPagesBatchesPage() {
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get('batchId');
  
  const {
    batches,
    isLoading,
    error,
    fetchBatches,
    handleViewPDF,
    handleViewBatchDetails
  } = useProductPageBatches();

  // Convert ProductPageBatch[] to BatchSummary[] for BatchesWrapper
  const batchSummaries = batches.map(batch => ({
    id: batch.id,
    name: batch.name,
    due_date: batch.due_date,
    status: batch.status,
    product_type: "Product Pages",
    sheets_required: batch.sheets_required,
    lamination_type: "none",
    front_pdf_url: batch.front_pdf_url,
    back_pdf_url: batch.back_pdf_url,
    overview_pdf_url: batch.overview_pdf_url || null,
    created_at: batch.created_at
  }));

  // If we're viewing a specific batch, render the BatchDetails component
  if (batchId) {
    return <ProductPageBatchDetails />;
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Product Page Batches</h1>

      {/* Error message if there's an issue fetching data */}
      {error && !isLoading && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchBatches}
            className="mt-2"
          >
            Try Again
          </Button>
        </Alert>
      )}

      <BatchesWrapper 
        batches={batchSummaries}
        isLoading={isLoading}
        error={error}
        onRefresh={fetchBatches}
        onViewPDF={handleViewPDF}
        onViewDetails={handleViewBatchDetails}
        onDeleteBatch={() => console.log('Delete batch not implemented')}
      />
    </div>
  );
}
