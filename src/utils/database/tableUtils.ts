
import { TableName, ExistingTableName } from "@/config/productTypes";

// Make the function signature match the one in tableValidation.ts
export const isExistingTable = (tableName: TableName): boolean => {
  const existingTables: ExistingTableName[] = [
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
  
  return existingTables.includes(tableName as ExistingTableName);
};
