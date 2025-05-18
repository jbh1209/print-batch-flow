
import React from 'react';
import GenericJobEditPage from './GenericJobEditPage';
import { productConfigs } from '@/config/productTypes';
import { isProductConfig } from '@/utils/validation/typeGuards';

const StickerJobEditPage = () => {
  const config = productConfigs["Stickers"];
  
  // Validate config at runtime to ensure it's valid
  if (!isProductConfig(config)) {
    console.error("Invalid product config for Stickers:", config);
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="text-xl font-semibold text-red-700">Configuration Error</h2>
        <p className="mt-2 text-red-600">
          The product configuration for Stickers is invalid. Please check your configuration files.
        </p>
      </div>
    );
  }
  
  return <GenericJobEditPage config={config} />;
};

export default StickerJobEditPage;
