
import React from "react";
import { useParams } from "react-router-dom";
import { productConfigs } from "@/config/productTypes";
import GenericBatchDetailsPage from "@/components/generic/GenericBatchDetailsPage";

interface FlyerBatchDetailsPageProps {
  productType?: string;
  backUrl?: string;
}

const FlyerBatchDetailsPage: React.FC<FlyerBatchDetailsPageProps> = ({ 
  productType = "Flyers",
  backUrl = "/batches/flyers"
}) => {
  const { batchId } = useParams<{ batchId: string }>();
  const config = productConfigs[productType] || productConfigs["Flyers"];
  
  if (!batchId) {
    return <div>No batch ID specified</div>;
  }
  
  return <GenericBatchDetailsPage config={config} batchId={batchId} />;
};

export default FlyerBatchDetailsPage;
