
import { useState } from "react";
import { useSearchParams, useParams, useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import BatchesWrapper from "@/components/batches/business-cards/BatchesWrapper";
import { ProductConfig, BaseBatch } from "@/config/productTypes";
import { BatchSummary } from "@/components/batches/types/BatchTypes";
import { LaminationType } from "@/components/batches/types/FlyerTypes";
import { useGenericBatches } from "@/hooks/generic/useGenericBatches";

interface GenericBatchesPageProps {
  config: ProductConfig;
  useBatchesHook?: () => {
    batches: BaseBatch[];
    isLoading: boolean;
    error: string | null;
    fetchBatches: () => Promise<void>;
    handleViewPDF: (url: string) => void;
    handleViewBatchDetails: (batchId: string) => void;
  };
}

const GenericBatchesPage = ({ config, useBatchesHook }: GenericBatchesPageProps) => {
  const navigate = useNavigate();
  const { batchId } = useParams<{ batchId: string }>();
  
  console.log(`GenericBatchesPage initializing for ${config.productType}`);
  
  // Use the provided hook or default to useGenericBatches
  const batchesHookFn = useBatchesHook || (() => useGenericBatches(config));
  
  const {
    batches,
    isLoading,
    error,
    fetchBatches,
    handleViewPDF,
    handleViewBatchDetails
  } = batchesHookFn();

  console.log(`${config.productType} batches loaded:`, batches.length);

  // Convert BaseBatch[] to BatchSummary[] by adding the product_type property and ensuring proper types
  const batchSummaries: BatchSummary[] = batches.map(batch => ({
    id: batch.id,
    name: batch.name,
    due_date: batch.due_date,
    status: batch.status as string,
    product_type: config.productType,
    sheets_required: batch.sheets_required,
    lamination_type: (batch.lamination_type as LaminationType) || null,
    front_pdf_url: batch.front_pdf_url,
    back_pdf_url: batch.back_pdf_url,
    created_at: batch.created_at,
  }));

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{config.ui.title || config.productType} Batches</h1>
          <p className="text-gray-500">View and manage all {(config.ui.title || config.productType).toLowerCase()} batches</p>
        </div>
      </div>

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
        onViewDetails={handleViewBatchDetails}
        onDeleteBatch={(id) => console.log('Delete batch', id)}
      />
    </div>
  );
};

export default GenericBatchesPage;
