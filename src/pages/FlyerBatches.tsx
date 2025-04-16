
import { useSearchParams } from "react-router-dom";
import { useFlyerBatches } from "@/hooks/useFlyerBatches";
import JobsHeader from "@/components/business-cards/JobsHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import FlyerBatchDetails from "./FlyerBatchDetails";
import BatchesWrapper from "@/components/batches/business-cards/BatchesWrapper";
import { BatchSummary } from "@/components/batches/types/BatchTypes";
import { FlyerBatch } from "@/components/batches/types/FlyerTypes";

const FlyerBatches = () => {
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get('batchId');
  
  const {
    batches,
    isLoading,
    error,
    fetchBatches,
    handleViewPDF
  } = useFlyerBatches();

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
        onDeleteBatch={(id) => console.log('Delete batch', id)}
      />
    </div>
  );
};

export default FlyerBatches;
