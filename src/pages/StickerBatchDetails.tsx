
import React from "react";
import BatchDetails from "@/components/batches/BatchDetails";

const StickerBatchDetails = () => {
  return (
    <BatchDetails 
      batchId="" // Will be extracted from URL params by the component
      productType="Stickers" 
      backUrl="/batchflow/batches/stickers/batches" 
    />
  );
};

export default StickerBatchDetails;
