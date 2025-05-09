
import React, { useEffect } from 'react';
import { productConfigs } from '@/config/productTypes';
import GenericBatchesPage from '@/components/generic/GenericBatchesPage';
import { useGenericBatches } from '@/hooks/generic/useGenericBatches';
import { getProductTypeCode } from '@/utils/batch/productTypeCodes';

const PosterBatchesPage = () => {
  const config = productConfigs["Posters"];
  
  useEffect(() => {
    const productCode = getProductTypeCode("Posters");
    console.log(`PosterBatchesPage initialized with product code: ${productCode}`);
    console.log('Poster config:', {
      productType: config.productType,
      tableName: config.tableName,
      jobNumberPrefix: config.jobNumberPrefix
    });
  }, []);
  
  // Use the useGenericBatches hook directly to expose more debugging info
  const batchesHook = () => {
    const hook = useGenericBatches(config);
    console.log('Posters batches data:', hook.batches);
    
    if (hook.batches.length === 0 && !hook.isLoading) {
      console.warn('No poster batches found! This might indicate a filtering issue.');
    } else {
      console.log('Poster batch names:', hook.batches.map(b => b.name).join(', '));
    }
    
    return hook;
  };
  
  return <GenericBatchesPage config={config} useBatchesHook={batchesHook} />;
};

export default PosterBatchesPage;
