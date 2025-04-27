
import { productConfigs } from "@/config/productTypes";
import { useGenericBatches } from "@/hooks/generic/useGenericBatches";
import GenericBatchesPage from "@/components/generic/GenericBatchesPage";

const SleeveBatchesPage = () => {
  const config = productConfigs["Sleeves"];
  
  // Create a wrapper function that returns the hook result
  const batchesHookWrapper = () => useGenericBatches(config);

  return <GenericBatchesPage config={config} useBatchesHook={batchesHookWrapper} />;
};

export default SleeveBatchesPage;
