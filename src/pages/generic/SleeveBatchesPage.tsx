
import React from 'react';
import { productConfigs } from '@/config/productTypes';
import GenericBatchesPage from '@/components/generic/GenericBatchesPage';

const SleeveBatchesPage = () => {
  const config = productConfigs["Sleeves"];
  
  return <GenericBatchesPage config={config} />;
};

export default SleeveBatchesPage;
