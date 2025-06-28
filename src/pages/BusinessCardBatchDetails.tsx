
import React from "react";
import BatchDetails from "@/components/batches/BatchDetails";

const BusinessCardBatchDetails = () => {
  return (
    <BatchDetails 
      batchId="" // Will be extracted from URL params by the component
      productType="Business Cards" 
      backUrl="/batchflow/batches/business-cards/batches" 
    />
  );
};

export default BusinessCardBatchDetails;
