
import { productConfigs } from "@/config/productTypes";
import GenericBatchesPage from "@/components/generic/GenericBatchesPage";

const BusinessCardBatchesPage = () => {
  const config = productConfigs["Business Cards"];
  
  return (
    <GenericBatchesPage config={config} />
  );
};

export default BusinessCardBatchesPage;
