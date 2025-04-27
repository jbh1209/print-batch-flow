
import { TableName } from "@/config/productTypes";

// Define table names that actually exist in the database
export const existingTables = [
  "flyer_jobs", 
  "postcard_jobs", 
  "business_card_jobs",
  "poster_jobs", 
  "sleeve_jobs",
  "batches",
  "profiles",
  "user_roles"
] as const;

// This creates a type based on the actual table names
export type ExistingTableName = typeof existingTables[number];

// Function to check if a table exists in our database
export const isExistingTable = (tableName: TableName | undefined): tableName is ExistingTableName => {
  if (!tableName) return false;
  return existingTables.includes(tableName as ExistingTableName);
};
