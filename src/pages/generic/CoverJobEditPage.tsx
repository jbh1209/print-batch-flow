
import React from 'react';
import GenericJobEditPage from './GenericJobEditPage';
import { productConfigs } from '@/config/productTypes';

const CoverJobEditPage = () => {
  return <GenericJobEditPage config={productConfigs["Covers"]} />;
};

export default CoverJobEditPage;
