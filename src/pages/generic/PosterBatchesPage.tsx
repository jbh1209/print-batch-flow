
import React from 'react';
import { productConfigs } from '@/config/productTypes';
import GenericBatchesPage from '@/components/generic/GenericBatchesPage';
import { useGenericBatches } from '@/hooks/generic/useGenericBatches';

const PosterBatchesPage = () => {
  const config = productConfigs["Posters"];
  
  // Use the useGenericBatches hook directly to expose more debugging info
  const batchesHook = () => {
    const hook = useGenericBatches(config);
    console.log('Posters batches data:', hook.batches);
    return hook;
  };
  
  return <GenericBatchesPage config={config} useBatchesHook={batchesHook} />;
};

export default PosterBatchesPage;
