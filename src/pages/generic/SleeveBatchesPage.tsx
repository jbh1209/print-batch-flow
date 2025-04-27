
import { useParams } from "react-router-dom";
import { productConfigs } from "@/config/productTypes";
import GenericBatchesPage from "@/components/generic/GenericBatchesPage";
import { useGenericBatches } from "@/hooks/generic/useGenericBatches";

const SleeveBatchesPage = () => {
  const config = productConfigs["Sleeves"];
  
  // Create a wrapper function that returns the hook result
  const batchesHookWrapper = () => useGenericBatches(config);
  
  return <GenericBatchesPage config={config} useBatchesHook={batchesHookWrapper} />;
};

export default SleeveBatchesPage;
