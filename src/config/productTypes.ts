
// Main entry point for product types that re-exports all types and configurations

// Re-export all types
export * from './types/baseTypes';
export * from './types/productConfigTypes';

// Import only the required product configs
import { businessCardsConfig } from './products/businessCards';
import { ProductConfig } from './types/productConfigTypes';
import { ExistingTableName } from './types/baseTypes';

// Export product configs dictionary with only Business Cards
export const productConfigs: Record<string, ProductConfig> = {
  "BusinessCards": businessCardsConfig,
};

// Additional type exports for compatibility
export type TableName = ExistingTableName;
export type JobStatus = 'queued' | 'batched' | 'processing' | 'completed' | 'cancelled';
