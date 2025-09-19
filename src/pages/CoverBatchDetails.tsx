
import React from "react";
import { useParams } from "react-router-dom";
import BatchDetails from "@/components/batches/BatchDetails";

const CoverBatchDetails = () => {
  const { batchId } = useParams<{ batchId: string }>();
  
  return (
    <BatchDetails 
      batchId={batchId || ""} 
      productType="Covers" 
      backUrl="/printstream/batches/covers/batches" 
    />
  );
};

export default CoverBatchDetails;
