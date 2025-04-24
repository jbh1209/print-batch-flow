
import { Database } from "@/integrations/supabase/types";
import { TableName } from "@/config/productTypes";

// Define table names that actually exist in the database
export const existingTables: TableName[] = [
  "flyer_jobs", 
  "postcard_jobs", 
  "business_card_jobs",
  "poster_jobs", 
  "sleeve_jobs",
  "batches",
  "profiles",
  "user_roles"
];

// Function to check if a table exists in our database
export const isExistingTable = (tableName: TableName | undefined): boolean => {
  if (!tableName) return false;
  return existingTables.includes(tableName);
};

// Use a simpler approach to map TableName to string without complex typings
export const getSupabaseTable = (tableName: TableName | undefined): string => {
  if (!tableName || !isExistingTable(tableName)) {
    throw new Error(`Invalid or non-existent table name: ${tableName}`);
  }
  
  // Simple string cast to avoid type depth issues
  return tableName;
};
