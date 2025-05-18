
import React from 'react';
import GenericJobEditPage from './GenericJobEditPage';
import { productConfigs } from '@/config/productTypes';

const StickerJobEditPage = () => {
  return <GenericJobEditPage config={productConfigs["Stickers"]} />;
};

export default StickerJobEditPage;
