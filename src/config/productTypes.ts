
// Main entry point for product types that re-exports all types and configurations

// Re-export all types
export * from './types/baseTypes';
export * from './types/productConfigTypes';

// Import only the required product configs
import { businessCardsConfig } from './products/businessCards';
import { flyersConfig } from './products/flyers';
import { ProductConfig } from './types/productConfigTypes';
import { ExistingTableName } from './types/baseTypes';

// Export product configs dictionary with only Business Cards and Flyers
export const productConfigs: Record<string, ProductConfig> = {
  "BusinessCards": businessCardsConfig,
  "Flyers": flyersConfig,
};

// Additional type exports for compatibility
export type TableName = ExistingTableName;
export type JobStatus = 'queued' | 'batched' | 'processing' | 'completed' | 'cancelled';
