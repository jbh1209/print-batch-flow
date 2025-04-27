
import { useParams } from "react-router-dom";
import { productConfigs } from "@/config/productTypes";
import { useGenericBatches } from "@/hooks/generic/useGenericBatches";
import GenericBatchesPage from "@/components/generic/GenericBatchesPage";

const SleeveBatchesPage = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const config = productConfigs["Sleeves"];
  
  // Create a wrapper function that returns the hook result
  // Pass batchId to useGenericBatches to fetch details when needed
  const batchesHookWrapper = () => useGenericBatches(config, batchId);

  return <GenericBatchesPage config={config} useBatchesHook={batchesHookWrapper} />;
};

export default SleeveBatchesPage;
