
import React from 'react';
import { productConfigs } from '@/config/productTypes';
import GenericBatchesPage from '@/components/generic/GenericBatchesPage';
import { useGenericBatches } from '@/hooks/generic/useGenericBatches';

const PostcardBatchesPage = () => {
  const config = productConfigs["Postcards"];
  
  // Use the useGenericBatches hook directly to expose more debugging info
  const batchesHook = () => {
    const hook = useGenericBatches(config);
    console.log('Postcards batches data:', hook.batches);
    return hook;
  };
  
  return <GenericBatchesPage config={config} useBatchesHook={batchesHook} />;
};

export default PostcardBatchesPage;
