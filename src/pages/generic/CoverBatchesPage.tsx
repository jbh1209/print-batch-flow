
import React, { useEffect } from 'react';
import { productConfigs } from '@/config/productTypes';
import GenericBatchesPage from '@/components/generic/GenericBatchesPage';
import { useGenericBatches } from '@/hooks/generic/useGenericBatches';
import { getProductTypeCode } from '@/utils/batch/productTypeCodes';

const CoverBatchesPage = () => {
  const config = productConfigs["Covers"];
  
  useEffect(() => {
    const productCode = getProductTypeCode("Covers");
    console.log(`CoverBatchesPage initialized with product code: ${productCode}`);
    console.log('Cover config:', {
      productType: config.productType,
      tableName: config.tableName,
      jobNumberPrefix: config.jobNumberPrefix
    });
  }, []);
  
  // Use the useGenericBatches hook directly to expose more debugging info
  const batchesHook = () => {
    const hook = useGenericBatches(config);
    console.log('Covers batches data:', hook.batches);
    
    if (hook.batches.length === 0 && !hook.isLoading) {
      console.warn('No cover batches found! This might indicate a filtering issue.');
    } else {
      console.log('Cover batch names:', hook.batches.map(b => b.name).join(', '));
    }
    
    return hook;
  };
  
  return <GenericBatchesPage config={config} useBatchesHook={batchesHook} />;
};

export default CoverBatchesPage;
