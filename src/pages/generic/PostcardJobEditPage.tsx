
import React from 'react';
import GenericJobEditPage from './GenericJobEditPage';
import { productConfigs } from '@/config/productTypes';

const PostcardJobEditPage = () => {
  return <GenericJobEditPage config={productConfigs["Postcards"]} />;
};

export default PostcardJobEditPage;
