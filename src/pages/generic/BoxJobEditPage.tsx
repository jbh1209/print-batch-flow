
import React from 'react';
import GenericJobEditPage from './GenericJobEditPage';
import { productConfigs } from '@/config/productTypes';

const BoxJobEditPage = () => {
  return <GenericJobEditPage config={productConfigs["Boxes"]} />;
};

export default BoxJobEditPage;
