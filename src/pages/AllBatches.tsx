
import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useBatchesList } from "@/hooks/useBatchesList";
import BatchDetails from "@/components/batches/BatchDetails";
import AllBatchesHeader from "@/components/batches/AllBatchesHeader";
import BatchesList from "@/components/batches/BatchesList";
import BatchesLoading from "@/components/batches/BatchesLoading";
import BatchesEmpty from "@/components/batches/BatchesEmpty";

const AllBatches = () => {
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get('batchId');
  const { batches, isLoading, error, fetchBatches, getBatchUrl } = useBatchesList();

  // If we're viewing a specific batch, render the BatchDetails component
  if (batchId) {
    // Get product type from the batches array based on batchId
    const selectedBatch = batches.find(batch => batch.id === batchId);
    const productType = selectedBatch?.product_type || "Unknown";
    
    return (
      <BatchDetails 
        batchId={batchId} 
        productType={productType} 
        backUrl="/batches/all" 
      />
    );
  }

  return (
    <div>
      <AllBatchesHeader />

      <BatchesList 
        batches={batches} 
        getBatchUrl={getBatchUrl} 
        isLoading={isLoading}
        error={error}
        onRetry={fetchBatches}
      />
    </div>
  );
};

export default AllBatches;
