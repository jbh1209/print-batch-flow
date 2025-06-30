
import { productConfigs } from '@/config/productTypes';

// Map batch category names to product config keys
export const BATCH_CATEGORY_MAPPING: Record<string, string> = {
  'business_cards': 'BusinessCards',
  'flyers': 'Flyers', 
  'postcards': 'Postcards',
  'posters': 'Posters',
  'sleeves': 'Sleeves',
  'stickers': 'Stickers',
  'boxes': 'Boxes',
  'covers': 'Covers'
};

// Get product config by batch category
export const getProductConfigByCategory = (batchCategory: string) => {
  const configKey = BATCH_CATEGORY_MAPPING[batchCategory];
  if (!configKey) {
    throw new Error(`Unknown batch category: ${batchCategory}`);
  }
  
  const config = productConfigs[configKey];
  if (!config) {
    throw new Error(`No product configuration found for category: ${batchCategory} (mapped to ${configKey})`);
  }
  
  return config;
};

// No more category-specific field mapping - all specifications now handled centrally
// This function is kept for backward compatibility but returns empty object
export const getCategorySpecificFields = (batchCategory: string, formData: Record<string, any>) => {
  // All specifications are now stored in job_print_specifications table
  // No hardcoded fields needed in the job tables anymore
  return {};
};
