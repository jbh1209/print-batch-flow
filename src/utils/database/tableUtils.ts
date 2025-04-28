
import { TableName, ExistingTableName } from "@/config/productTypes";

// This function checks if a given table name exists in the database
export function isExistingTable(tableName: TableName | undefined): tableName is ExistingTableName {
  if (!tableName) return false;
  
  const existingTables: ExistingTableName[] = [
    "flyer_jobs",
    "postcard_jobs", 
    "business_card_jobs",
    "poster_jobs",
    "sleeve_jobs",
    "cover_jobs",
    "sticker_jobs", 
    "box_jobs",
    "batches",
    "profiles",
    "user_roles"
  ];
  
  return existingTables.includes(tableName as ExistingTableName);
}
