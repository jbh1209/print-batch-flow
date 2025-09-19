
import React from "react";
import { useParams } from "react-router-dom";
import BatchDetails from "@/components/batches/BatchDetails";

const BoxBatchDetails = () => {
  const { batchId } = useParams<{ batchId: string }>();
  
  return (
    <BatchDetails 
      batchId={batchId || ""} 
      productType="Boxes" 
      backUrl="/printstream/batches/boxes/batches" 
    />
  );
};

export default BoxBatchDetails;
