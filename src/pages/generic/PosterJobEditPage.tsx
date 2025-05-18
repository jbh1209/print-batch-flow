
import React from 'react';
import GenericJobEditPage from './GenericJobEditPage';
import { productConfigs } from '@/config/productTypes';

const PosterJobEditPage = () => {
  return <GenericJobEditPage config={productConfigs["Posters"]} />;
};

export default PosterJobEditPage;
