
import React from "react";
import { useParams } from "react-router-dom";
import BatchDetails from "@/components/batches/BatchDetails";

const SleeveBatchDetails = () => {
  const { batchId } = useParams<{ batchId: string }>();
  
  return (
    <BatchDetails 
      batchId={batchId || ""} 
      productType="Sleeves" 
      backUrl="/batchflow/batches/sleeves/batches" 
    />
  );
};

export default SleeveBatchDetails;
