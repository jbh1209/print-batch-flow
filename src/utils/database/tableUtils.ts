
import { ExistingTableName } from '@/config/productTypes';

export const isExistingTable = (tableName: string): tableName is ExistingTableName => {
  const existingTables: ExistingTableName[] = [
    "flyer_jobs",
    "postcard_jobs", 
    "business_card_jobs",
    "poster_jobs",
    "batches", 
    "profiles", 
    "user_roles"
  ];
  
  return existingTables.includes(tableName as ExistingTableName);
};
