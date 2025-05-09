
import React from 'react';
import { productConfigs } from '@/config/productTypes';
import GenericBatchesPage from '@/components/generic/GenericBatchesPage';
import { useGenericBatches } from '@/hooks/generic/useGenericBatches';

const SleeveBatchesPage = () => {
  const config = productConfigs["Sleeves"];
  
  // Use the useGenericBatches hook directly to expose more debugging info
  const batchesHook = () => {
    const hook = useGenericBatches(config);
    console.log('Sleeves batches data:', hook.batches);
    return hook;
  };
  
  return <GenericBatchesPage config={config} useBatchesHook={batchesHook} />;
};

export default SleeveBatchesPage;
