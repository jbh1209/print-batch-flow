
import React from "react";
import { useParams } from "react-router-dom";
import BatchDetails from "@/components/batches/BatchDetails";

interface BatchDetailsPageProps {
  productType: string;
  backUrl: string;
}

const BatchDetailsPage = ({ productType, backUrl }: BatchDetailsPageProps) => {
  const { batchId } = useParams<{ batchId: string }>();
  
  console.log("=== BatchDetailsPage Debug ===");
  console.log("BatchId from params:", batchId);
  console.log("ProductType:", productType);
  console.log("BackUrl:", backUrl);

  if (!batchId) {
    console.error("No batchId in URL params");
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">No Batch Selected</h2>
        <p className="text-gray-500">Please select a batch to view its details.</p>
      </div>
    );
  }

  return (
    <BatchDetails 
      batchId={batchId} 
      productType={productType} 
      backUrl={backUrl} 
    />
  );
};

export default BatchDetailsPage;
