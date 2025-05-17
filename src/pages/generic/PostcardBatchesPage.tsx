
import React from 'react';
import { productConfigs } from '@/config/productTypes';
import GenericBatchesPage from '@/components/generic/GenericBatchesPage';

const PostcardBatchesPage = () => {
  const config = productConfigs["Postcards"];
  
  return <GenericBatchesPage config={config} />;
};

export default PostcardBatchesPage;
