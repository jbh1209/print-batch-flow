
import { Database } from "@/integrations/supabase/types";

// Define literal type using the actual table names from Supabase types
export type SupabaseTableName = 
  | "flyer_jobs" 
  | "postcard_jobs" 
  | "business_card_jobs"
  | "poster_jobs" 
  | "sleeve_jobs"
  | "batches"
  | "profiles"
  | "user_roles";

// Define table names that actually exist in the database - this must match exactly what's in Supabase
export const existingTables: SupabaseTableName[] = [
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
export type TableName = SupabaseTableName | "sticker_jobs" | "box_jobs" | "cover_jobs";

// Function to check if a table exists in our database
export const isExistingTable = (tableName: TableName | undefined): boolean => {
  if (!tableName) return false;
  return existingTables.includes(tableName as SupabaseTableName);
};

// Function to safely cast a TableName to a SupabaseTableName
export function getSupabaseTable(tableName: TableName | undefined): SupabaseTableName {
  if (!tableName || !isExistingTable(tableName)) {
    throw new Error(`Invalid or non-existent table name: ${tableName}`);
  }
  
  return tableName as SupabaseTableName;
}

// Alias for getSupabaseTable for backward compatibility
export const asSupabaseTable = getSupabaseTable;
