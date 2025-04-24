
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

// Define type for tables that are actually in the database
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

// Helper function to safely cast a TableName to SupabaseTableName for use with Supabase client
export const asSupabaseTable = (tableName: TableName | undefined): SupabaseTableName => {
  if (!tableName || !isExistingTable(tableName)) {
    throw new Error(`Invalid or non-existent table name: ${tableName}`);
  }
  return tableName as SupabaseTableName;
};
