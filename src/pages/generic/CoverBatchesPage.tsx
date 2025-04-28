
import React from 'react';
import { productConfigs } from '@/config/productTypes';
import GenericBatchesPage from '@/components/generic/GenericBatchesPage';

const CoverBatchesPage = () => {
  const config = productConfigs["Covers"];
  
  return <GenericBatchesPage config={config} />;
};

export default CoverBatchesPage;
