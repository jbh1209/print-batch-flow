
import React from 'react';
import { productConfigs } from '@/config/productTypes';
import GenericBatchesPage from '@/components/generic/GenericBatchesPage';

const StickerBatchesPage = () => {
  const config = productConfigs["Stickers"];
  
  return <GenericBatchesPage config={config} />;
};

export default StickerBatchesPage;
