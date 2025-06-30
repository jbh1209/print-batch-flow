
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
export const getCategorySpecificFields = (batchCategory: string, formData: Record<string, any>) => {
  switch (batchCategory) {
    case 'business_cards':
      return {
        paper_type: formData.paper_type || '350gsm Matt',
        lamination_type: formData.lamination_type || 'none',
        double_sided: formData.double_sided || false,
        paper_weight: formData.paper_weight || '350gsm'
      };
    
    case 'flyers':
      return {
        size: formData.size || 'A4',
        paper_type: formData.paper_type || 'Matt',
        paper_weight: formData.paper_weight || '130gsm'
      };
    
    case 'postcards':
      return {
        size: formData.size || 'A6',
        paper_type: formData.paper_type || 'Gloss',
        paper_weight: formData.paper_weight || '300gsm',
        sides: formData.sides || 'single',
        lamination_type: formData.lamination_type || 'no_lam'
      };
    
    case 'posters':
      return {
        size: formData.size || 'A4',
        paper_type: formData.paper_type || 'Matt',
        paper_weight: formData.paper_weight || '200gsm',
        sides: formData.sides || 'single'
      };
    
    case 'sleeves':
      return {
        stock_type: formData.paper_type || 'Kraft',
        single_sided: formData.single_sided !== false
      };
    
    case 'stickers':
      return {
        paper_type: formData.paper_type || 'Paper',
        lamination_type: formData.lamination_type || 'none'
      };
    
    case 'boxes':
      return {
        paper_type: formData.paper_type || 'FBB 230gsm',
        lamination_type: formData.lamination_type || 'matt'
      };
    
    case 'covers':
      return {
        paper_type: formData.paper_type || '250gsm Matt',
        paper_weight: formData.paper_weight || '250gsm',
        lamination_type: formData.lamination_type || 'none',
        sides: formData.sides || 'single',
        uv_varnish: formData.uv_varnish || 'none'
      };
    
    default:
      return {};
  }
};
