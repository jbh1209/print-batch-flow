
import React from "react";
import BatchDetails from "@/components/batches/BatchDetails";

const PosterBatchDetails = () => {
  return (
    <BatchDetails 
      batchId="" // Will be extracted from URL params by the component
      productType="Posters" 
      backUrl="/batchflow/batches/posters/batches" 
    />
  );
};

export default PosterBatchDetails;
