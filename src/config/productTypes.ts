
import { ExistingTableName, BaseBatch, BaseJob, BatchStatus } from './types/baseTypes';
import { businessCardsConfig } from './products/businessCards';
import { flyersConfig } from './products/flyers';
import { postcardsConfig } from './products/postcards';
import { postersConfig } from './products/posters';
import { sleevesConfig } from './products/sleeves';
import { boxesConfig } from './products/boxes';
import { coversConfig } from './products/covers';
import { stickersConfig } from './products/stickers';
import { ProductConfig } from './types/productConfigTypes';

export type TableName = ExistingTableName;

export type ProductType =
  | 'flyers'
  | 'postcards'
  | 'business-cards'
  | 'posters'
  | 'sleeves'
  | 'boxes'
  | 'covers'
  | 'stickers'
  | 'product-pages';

export type LaminationType =
  | 'none'
  | 'gloss'
  | 'matte'  // Note: changed from 'matt' to 'matte' to match the expected type
  | 'soft-touch';

// Create and export the productConfigs object
export const productConfigs: Record<string, ProductConfig> = {
  "Flyers": flyersConfig,
  "Postcards": postcardsConfig,
  "BusinessCards": businessCardsConfig,
  "Posters": postersConfig,
  "Sleeves": sleevesConfig,
  "Boxes": boxesConfig,
  "Covers": coversConfig,
  "Stickers": stickersConfig
};

// Re-export types from baseTypes
export type { ExistingTableName, BaseBatch, BaseJob, BatchStatus, BatchFixOperationResult } from './types/baseTypes';
export type { ProductConfig } from './types/productConfigTypes';
