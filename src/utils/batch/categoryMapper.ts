
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

// Get category-specific field mapping for database insertion
export const getCategorySpecificFields = (batchCategory: string, specifications: Record<string, any>) => {
  switch (batchCategory) {
    case 'business_cards':
      return {
        paper_type: specifications.paperType || '350gsm Matt',
        lamination_type: specifications.laminationType || 'none',
        double_sided: specifications.doubleSided || false,
        paper_weight: specifications.paperWeight || '350gsm'
      };
    
    case 'flyers':
      return {
        size: specifications.size || 'A4',
        paper_type: specifications.paperType || 'Matt',
        paper_weight: specifications.paperWeight || '130gsm'
      };
    
    case 'postcards':
      return {
        size: specifications.size || 'A6',
        paper_type: specifications.paperType || 'Gloss',
        paper_weight: specifications.paperWeight || '300gsm',
        sides: specifications.sides || 'single',
        lamination_type: specifications.laminationType || 'no_lam'
      };
    
    case 'posters':
      return {
        size: specifications.size || 'A4',
        paper_type: specifications.paperType || 'Matt',
        paper_weight: specifications.paperWeight || '200gsm',
        sides: specifications.sides || 'single'
      };
    
    case 'sleeves':
      return {
        stock_type: specifications.paperType || 'Kraft',
        single_sided: specifications.singleSided !== false
      };
    
    case 'stickers':
      return {
        paper_type: specifications.paperType || 'Paper',
        lamination_type: specifications.laminationType || 'none'
      };
    
    case 'boxes':
      return {
        paper_type: specifications.paperType || 'FBB 230gsm',
        lamination_type: specifications.laminationType || 'matt'
      };
    
    case 'covers':
      return {
        paper_type: specifications.paperType || '250gsm Matt',
        paper_weight: specifications.paperWeight || '250gsm',
        lamination_type: specifications.laminationType || 'none',
        sides: specifications.sides || 'single',
        uv_varnish: specifications.uvVarnish || 'none'
      };
    
    default:
      return {};
  }
};
