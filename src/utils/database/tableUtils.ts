
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

// Type that represents valid tables in Supabase database
export type ValidSupabaseTableName = "flyer_jobs" | "postcard_jobs" | "business_card_jobs" | 
  "poster_jobs" | "sleeve_jobs" | "batches" | "profiles" | "user_roles";

// Function to check if a table exists in our database
export const isExistingTable = (tableName: TableName | undefined): boolean => {
  if (!tableName) return false;
  return existingTables.includes(tableName);
};

// Function to safely cast a TableName to a ValidSupabaseTableName
export function getSupabaseTable(tableName: TableName | undefined): ValidSupabaseTableName {
  if (!tableName || !isExistingTable(tableName)) {
    throw new Error(`Invalid or non-existent table name: ${tableName}`);
  }
  
  return tableName as ValidSupabaseTableName;
}

// Alias for getSupabaseTable for backward compatibility
export const asSupabaseTable = getSupabaseTable;
