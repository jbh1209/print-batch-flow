
import React from 'react';
import { productConfigs } from '@/config/productTypes';
import GenericBatchesPage from '@/components/generic/GenericBatchesPage';

const BoxBatchesPage = () => {
  const config = productConfigs["Boxes"];
  
  return <GenericBatchesPage config={config} />;
};

export default BoxBatchesPage;
