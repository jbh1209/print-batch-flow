
import React from 'react';
import { productConfigs } from '@/config/productTypes';
import GenericBatchesPage from '@/components/generic/GenericBatchesPage';

const PosterBatchesPage = () => {
  const config = productConfigs["Posters"];
  
  return <GenericBatchesPage config={config} />;
};

export default PosterBatchesPage;
