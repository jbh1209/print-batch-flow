
import { Database } from "@/integrations/supabase/types";

// Define valid table names from the database
export type ValidTableName = keyof Database['public']['Tables'];

// Map product types to their respective job tables
export function getProductJobsTable(productType: string): ValidTableName | null {
  switch (productType) {
    case "Business Cards":
      return "business_card_jobs";
    case "Flyers":
      return "flyer_jobs";
    case "Postcards":
      return "postcard_jobs";
    case "Posters":
      return "poster_jobs";
    case "Sleeves":
      return "sleeve_jobs";
    case "Stickers":
      return "sticker_jobs";
    case "Covers":
      return "cover_jobs";
    case "Boxes":
      return "box_jobs";
    default:
      console.error(`Unknown product type: ${productType}`);
      return null;
  }
}

// Validate if a table exists in our database schema
export function isValidTable(tableName: string): tableName is ValidTableName {
  const validTables: ValidTableName[] = [
    "business_card_jobs", 
    "flyer_jobs", 
    "postcard_jobs", 
    "poster_jobs", 
    "sleeve_jobs", 
    "sticker_jobs", 
    "cover_jobs", 
    "box_jobs",
    "batches",
    "profiles",
    "product_types",
    "app_settings",
    "user_roles",
    "product_fields",
    "product_field_options",
    "product_pages",
    "product_page_templates"
  ];
  
  return validTables.includes(tableName as ValidTableName);
}
