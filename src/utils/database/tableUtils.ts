
import { Database } from "@/integrations/supabase/types";

// Define literal type using the actual table names from the Database types
// IMPORTANT: Only include tables that actually exist in the Supabase database
export type SupabaseTableName = 
  | "flyer_jobs" 
  | "postcard_jobs" 
  | "business_card_jobs"
  | "sleeve_jobs"
  | "batches"
  | "profiles"
  | "user_roles";

// Define table names that actually exist in the database - this must match exactly what's in Supabase
export const existingTables: SupabaseTableName[] = [
  "flyer_jobs", 
  "postcard_jobs", 
  "business_card_jobs",
  "sleeve_jobs",
  "batches",
  "profiles",
  "user_roles"
];

// Type that represents all tables, including those that might not exist yet
export type TableName = 
  | SupabaseTableName 
  | "sticker_jobs" 
  | "box_jobs" 
  | "cover_jobs";

// Function to check if a table exists in our database
export const isExistingTable = (tableName: TableName | undefined): tableName is SupabaseTableName => {
  if (!tableName) return false;
  return existingTables.includes(tableName as SupabaseTableName);
};

// Function to safely cast a TableName to a SupabaseTableName
export function getSupabaseTable(tableName: TableName | undefined): SupabaseTableName {
  if (!tableName || !isExistingTable(tableName)) {
    throw new Error(`Invalid or non-existent table name: ${tableName}`);
  }
  
  return tableName;
}

// Alias for getSupabaseTable for backward compatibility
export const asSupabaseTable = getSupabaseTable;
