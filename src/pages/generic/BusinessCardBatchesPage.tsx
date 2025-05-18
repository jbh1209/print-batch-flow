
import { useGenericBatches } from "@/hooks/generic/useGenericBatches";
import { productConfigs } from "@/config/productTypes";
import GenericBatchesPage from "@/components/generic/GenericBatchesPage";

const BusinessCardBatchesPage = () => {
  const config = productConfigs["Business Cards"];
  
  return <GenericBatchesPage 
    productType="Business Cards"
    tableName="business_card_batches"
    jobsTableName="business_card_jobs"
    config={config}
  />;
};

export default BusinessCardBatchesPage;
