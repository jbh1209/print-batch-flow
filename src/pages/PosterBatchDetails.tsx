
import React from "react";
import { useParams } from "react-router-dom";
import BatchDetails from "@/components/batches/BatchDetails";

const PosterBatchDetails = () => {
  const { batchId } = useParams<{ batchId: string }>();
  
  return (
    <BatchDetails 
      batchId={batchId || ""} 
      productType="Posters" 
      backUrl="/batchflow/batches/posters/batches" 
    />
  );
};

export default PosterBatchDetails;
