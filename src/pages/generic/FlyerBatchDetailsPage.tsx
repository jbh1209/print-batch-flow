
import React from "react";
import { useParams } from "react-router-dom";
import { productConfigs } from "@/config/productTypes";
import GenericBatchDetailsPage from "./GenericBatchDetailsPage";

const FlyerBatchDetailsPage = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const config = productConfigs["Flyers"];
  
  if (!batchId) {
    return <div>No batch ID specified</div>;
  }
  
  return <GenericBatchDetailsPage config={config} batchId={batchId} />;
};

export default FlyerBatchDetailsPage;
