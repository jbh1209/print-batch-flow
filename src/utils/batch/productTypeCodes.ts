
// Define standard product type codes for batch naming
export const PRODUCT_TYPE_CODES = {
  "Business Cards": "BC",
  "BusinessCards": "BC",
  "Flyers": "FL",
  "Postcards": "PC",
  "Posters": "POS",
  "Sleeves": "SL",
  "Boxes": "PB",
  "Covers": "COV",
  "Stickers": "STK"
};

// Function to get the code for a product type
export const getProductTypeCode = (productType: string): string => {
  return PRODUCT_TYPE_CODES[productType] || "UNK";
};
