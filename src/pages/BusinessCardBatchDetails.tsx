
import React from "react";
import { useParams } from "react-router-dom";
import BatchDetails from "@/components/batches/BatchDetails";

const BusinessCardBatchDetails = () => {
  const { batchId } = useParams<{ batchId: string }>();
  
  return (
    <BatchDetails 
      batchId={batchId || ""} 
      productType="Business Cards" 
      backUrl="/printstream/batches/business-cards/batches" 
    />
  );
};

export default BusinessCardBatchDetails;
