
// Main entry point for product types that re-exports all types and configurations

// Re-export types with explicit names to avoid ambiguity
import { BatchStatus, JobStatus as BaseJobStatus, BaseJob, BaseBatch } from './types/baseTypes';
import { LaminationType as ConfigLaminationType } from './types/productConfigTypes';

// Re-export with unique names using 'export type' for TypeScript modules
export type { BatchStatus, BaseJobStatus, BaseJob, BaseBatch };
export type { ConfigLaminationType };

// Export ExistingTableName to fix errors in other modules
export type { ExistingTableName } from './types/baseTypes';

// Additional exports
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
export type JobStatus = BaseJobStatus;
export type LaminationType = ConfigLaminationType;
