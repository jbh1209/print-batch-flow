
import React from "react";
import BatchDetails from "@/components/batches/BatchDetails";

const BoxBatchDetails = () => {
  return (
    <BatchDetails 
      batchId="" // Will be extracted from URL params by the component
      productType="Boxes" 
      backUrl="/batchflow/batches/boxes/batches" 
    />
  );
};

export default BoxBatchDetails;
