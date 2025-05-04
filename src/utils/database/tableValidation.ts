
import { TableName, ExistingTableName } from "@/config/productTypes";

export const isExistingTable = (tableName: TableName): tableName is ExistingTableName => {
  const existingTables: ExistingTableName[] = [
    "flyer_jobs",
    "postcard_jobs", 
    "business_card_jobs",
    "poster_jobs",
    "sleeve_jobs",
    "box_jobs",
    "cover_jobs",
    "sticker_jobs",  // Ensure this is included
    "batches", 
    "profiles", 
    "user_roles"
  ];
  
  if (!tableName) {
    console.error("tableName is undefined or empty");
    return false;
  }
  
  const isValid = existingTables.includes(tableName as ExistingTableName);
  
  if (!isValid) {
    console.error(`Table ${tableName} is not in the list of existing tables:`, existingTables);
  }
  
  return isValid;
};
