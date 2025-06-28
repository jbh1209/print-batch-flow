
import React from "react";
import BatchDetails from "@/components/batches/BatchDetails";

const CoverBatchDetails = () => {
  return (
    <BatchDetails 
      batchId="" // Will be extracted from URL params by the component
      productType="Covers" 
      backUrl="/batchflow/batches/covers/batches" 
    />
  );
};

export default CoverBatchDetails;
