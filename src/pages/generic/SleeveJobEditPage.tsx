
import React from 'react';
import GenericJobEditPage from './GenericJobEditPage';
import { productConfigs } from '@/config/productTypes';

const SleeveJobEditPage = () => {
  return <GenericJobEditPage config={productConfigs["Sleeves"]} />;
};

export default SleeveJobEditPage;
