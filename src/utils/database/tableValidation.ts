
import { TableName } from "@/config/productTypes";

// Define the valid table names type
export type ValidTableName = 
  | "flyer_jobs" 
  | "postcard_jobs" 
  | "business_card_jobs" 
  | "poster_jobs" 
  | "sleeve_jobs" 
  | "box_jobs" 
  | "cover_jobs" 
  | "sticker_jobs" 
  | "batches" 
  | "profiles" 
  | "user_roles";

// List of valid table names for runtime checking
export const validTableNames: ValidTableName[] = [
  "flyer_jobs",
  "postcard_jobs", 
  "business_card_jobs",
  "poster_jobs",
  "sleeve_jobs",
  "box_jobs",
  "cover_jobs",
  "sticker_jobs",
  "batches", 
  "profiles", 
  "user_roles"
];

// Function to check if a table name is valid
export const isExistingTable = (tableName: TableName): tableName is ValidTableName => {
  if (!tableName) {
    console.error("tableName is undefined or empty");
    return false;
  }

  // Check if the tableName is in our list of existing tables
  return validTableNames.includes(tableName as ValidTableName);
};
