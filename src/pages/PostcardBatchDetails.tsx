
import React from "react";
import { useParams } from "react-router-dom";
import BatchDetails from "@/components/batches/BatchDetails";

const PostcardBatchDetails = () => {
  const { batchId } = useParams<{ batchId: string }>();
  
  return (
    <BatchDetails 
      batchId={batchId || ""} 
      productType="Postcards" 
      backUrl="/batchflow/batches/postcards/batches" 
    />
  );
};

export default PostcardBatchDetails;
