
// Main entry point for product types that re-exports all types and configurations

// Re-export all types
export * from './types/baseTypes';
export * from './types/productConfigTypes';

// Import all product configs
import { businessCardsConfig } from './products/businessCards';
import { flyersConfig } from './products/flyers';
import { postcardsConfig } from './products/postcards';
import { sleevesConfig } from './products/sleeves';
import { stickersConfig } from './products/stickers';
import { postersConfig } from './products/posters';
import { coversConfig } from './products/covers';
import { boxesConfig } from './products/boxes';
import { ProductConfig } from './types/productConfigTypes';
import { ExistingTableName } from './types/baseTypes';

// For debugging purposes, log each config's productType
console.log("Product configs being loaded:");
console.log("Business Cards config productType:", businessCardsConfig.productType);
console.log("Flyers config productType:", flyersConfig.productType);
console.log("Postcards config productType:", postcardsConfig.productType);
console.log("Sleeves config productType:", sleevesConfig.productType);
console.log("Stickers config productType:", stickersConfig.productType);
console.log("Posters config productType:", postersConfig.productType);
console.log("Covers config productType:", coversConfig.productType);
console.log("Boxes config productType:", boxesConfig.productType);

// Export product configs dictionary with consistent key naming
export const productConfigs: Record<string, ProductConfig> = {
  "Business Cards": businessCardsConfig,
  "Flyers": flyersConfig,
  "Postcards": postcardsConfig,
  "Sleeves": sleevesConfig,
  "Stickers": stickersConfig,
  "Posters": postersConfig,
  "Covers": coversConfig,
  "Boxes": boxesConfig,
};

// Additional debugging for the productConfigs
console.log("productConfigs keys:", Object.keys(productConfigs));

// Additional type exports for compatibility
export type TableName = ExistingTableName;
export type JobStatus = 'queued' | 'batched' | 'processing' | 'completed' | 'cancelled';
