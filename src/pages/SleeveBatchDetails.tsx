
import React from "react";
import BatchDetails from "@/components/batches/BatchDetails";

const SleeveBatchDetails = () => {
  return (
    <BatchDetails 
      batchId="" // Will be extracted from URL params by the component
      productType="Sleeves" 
      backUrl="/batchflow/batches/sleeves/batches" 
    />
  );
};

export default SleeveBatchDetails;
