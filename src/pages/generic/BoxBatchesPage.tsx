
import React from 'react';
import { productConfigs } from '@/config/productTypes';
import GenericBatchesPage from '@/components/generic/GenericBatchesPage';
import { useGenericBatches } from '@/hooks/generic/useGenericBatches';

const BoxBatchesPage = () => {
  const config = productConfigs["Boxes"];
  
  // Use the useGenericBatches hook directly to expose more debugging info
  const batchesHook = () => {
    const hook = useGenericBatches(config);
    console.log('Boxes batches data:', hook.batches);
    return hook;
  };
  
  return <GenericBatchesPage config={config} useBatchesHook={batchesHook} />;
};

export default BoxBatchesPage;
