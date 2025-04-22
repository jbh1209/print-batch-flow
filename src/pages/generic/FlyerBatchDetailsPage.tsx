
import React from "react";
import { productConfigs } from "@/config/productTypes";
import GenericBatchDetailsPage from "@/components/generic/GenericBatchDetailsPage";

const FlyerBatchDetailsPage = () => {
  const config = productConfigs["Flyers"];
  
  return <GenericBatchDetailsPage config={config} />;
};

export default FlyerBatchDetailsPage;
