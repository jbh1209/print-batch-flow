
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

// Export product configs dictionary
export const productConfigs: Record<string, ProductConfig> = {
  "BusinessCards": businessCardsConfig,
  "Flyers": flyersConfig,
  "Postcards": postcardsConfig,
  "Sleeves": sleevesConfig,
  "Stickers": stickersConfig,
  "Posters": postersConfig,
  "Covers": coversConfig,
  "Boxes": boxesConfig,
};

// Additional type exports for compatibility
export type TableName = ExistingTableName;
export type JobStatus = 'queued' | 'batched' | 'processing' | 'completed' | 'cancelled';
