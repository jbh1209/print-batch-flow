
import React from "react";
import { useParams } from "react-router-dom";
import BatchDetails from "@/components/batches/BatchDetails";

const StickerBatchDetails = () => {
  const { batchId } = useParams<{ batchId: string }>();
  
  return (
    <BatchDetails 
      batchId={batchId || ""} 
      productType="Stickers" 
      backUrl="/batchflow/batches/stickers/batches" 
    />
  );
};

export default StickerBatchDetails;
