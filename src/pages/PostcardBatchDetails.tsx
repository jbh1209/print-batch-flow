
import React from "react";
import BatchDetails from "@/components/batches/BatchDetails";

const PostcardBatchDetails = () => {
  return (
    <BatchDetails 
      batchId="" // Will be extracted from URL params by the component
      productType="Postcards" 
      backUrl="/batchflow/batches/postcards/batches" 
    />
  );
};

export default PostcardBatchDetails;
