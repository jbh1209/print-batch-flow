import { useParams } from "react-router-dom";
import { productConfigs } from "@/config/productTypes";
import { useGenericBatchDetails } from "@/hooks/generic/useGenericBatchDetails";
import { useGenericBatches } from "@/hooks/generic/useGenericBatches";
import GenericBatchDetailsPage from "@/components/generic/GenericBatchDetailsPage";
import GenericBatchesPage from "@/components/generic/GenericBatchesPage";

const SleeveBatchesPage = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const config = productConfigs["Sleeves"];
  
  // If we have a batchId, show the batch details page
  if (batchId) {
    return <GenericBatchDetailsPage config={config} batchId={batchId} />;
  }

  // Otherwise show the batches list
  const batchesHookWrapper = () => useGenericBatches(config);
  return <GenericBatchesPage config={config} useBatchesHook={batchesHookWrapper} />;
};

export default SleeveBatchesPage;
