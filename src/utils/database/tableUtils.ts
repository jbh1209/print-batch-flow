
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

// Valid database tables that can be used with Supabase queries
export type SupabaseTableName = 
  | "flyer_jobs"
  | "postcard_jobs"
  | "business_card_jobs"
  | "poster_jobs"
  | "sleeve_jobs"
  | "batches"
  | "profiles"
  | "user_roles";

// Function to check if a table exists in our database
export const isExistingTable = (tableName: TableName | undefined): boolean => {
  if (!tableName) return false;
  return existingTables.includes(tableName);
};

// Function to safely cast a TableName to a string for Supabase queries
export const getSupabaseTable = (tableName: TableName | undefined): SupabaseTableName => {
  if (!tableName || !isExistingTable(tableName)) {
    throw new Error(`Invalid or non-existent table name: ${tableName}`);
  }
  
  // Cast to SupabaseTableName since we've verified it exists
  return tableName as SupabaseTableName;
};

// Alias for getSupabaseTable for backward compatibility
export const asSupabaseTable = getSupabaseTable;
