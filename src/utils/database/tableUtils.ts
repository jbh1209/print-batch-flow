
import { TableName } from "@/config/productTypes";

// Define table names that actually exist in the database
export const existingTables: TableName[] = [
  "flyer_jobs", 
  "postcard_jobs", 
  "business_card_jobs",
  "poster_jobs", 
  "sleeve_jobs",  // Added this line to include sleeve_jobs as existing table
  "batches",
  "profiles",
  "user_roles"
];

// Function to check if a table exists in our database
export const isExistingTable = (tableName: TableName | undefined): boolean => {
  if (!tableName) return false;
  return existingTables.includes(tableName);
};
