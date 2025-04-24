
import { Database } from "@/integrations/supabase/types";
import { TableName } from "@/config/productTypes";

// Use the actual types from the Supabase database
type DbTables = Database['public']['Tables'];
export type SupabaseTableName = keyof DbTables;

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

// Helper function to safely cast a TableName to SupabaseTableName for use with Supabase client
export const asSupabaseTable = (tableName: TableName | undefined): SupabaseTableName => {
  if (!tableName || !isExistingTable(tableName)) {
    throw new Error(`Invalid or non-existent table name: ${tableName}`);
  }
  
  // Here we need to ensure that TypeScript knows this is a valid Supabase table name
  // We do a runtime check and then cast the result
  return tableName as SupabaseTableName;
};
