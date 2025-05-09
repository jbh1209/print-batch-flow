
// Define standard product type codes for batch naming
export const PRODUCT_TYPE_CODES = {
  "Business Cards": "BC",
  "BusinessCards": "BC",
  "Flyers": "FL",
  "Postcards": "PC",
  "Posters": "POS",
  "Sleeves": "SL",
  "Boxes": "PB",
  "Product Boxes": "PB",
  "Covers": "COV",
  "Stickers": "STK",
  "Zund Stickers": "STK"
};

// Define reverse mapping - used to find product type from code
export const CODE_TO_PRODUCT_TYPE: Record<string, string> = {
  "BC": "Business Cards",
  "FL": "Flyers",
  "PC": "Postcards",
  "POS": "Posters",
  "SL": "Sleeves",
  "PB": "Boxes",
  "COV": "Covers",
  "STK": "Stickers"
};

// Function to get the code for a product type
export const getProductTypeCode = (productType: string): string => {
  const code = PRODUCT_TYPE_CODES[productType];
  if (!code) {
    console.warn(`No product code found for product type: ${productType}`);
    return "UNK";
  }
  console.log(`Product type "${productType}" maps to code: ${code}`);
  return code;
};

// Function to get product type from code
export const getProductTypeFromCode = (code: string): string => {
  const productType = CODE_TO_PRODUCT_TYPE[code];
  if (!productType) {
    console.warn(`No product type found for code: ${code}`);
    return "Unknown";
  }
  return productType;
};

// Helper function to extract product code from batch name
export const extractProductCodeFromBatchName = (batchName: string): string | null => {
  // Try different batch naming patterns:
  // 1. Standard DXB-XX-##### format
  const standardMatch = batchName.match(/DXB-([A-Z]{2,3})-\d+/);
  if (standardMatch && standardMatch[1]) {
    return standardMatch[1];
  }
  
  // 2. Alternative -XX- format (any prefix)
  const alternateMatch = batchName.match(/-([A-Z]{2,3})-/);
  if (alternateMatch && alternateMatch[1]) {
    return alternateMatch[1];
  }
  
  return null;
};
