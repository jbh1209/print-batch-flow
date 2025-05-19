
import { ExistingTableName } from '@/config/types/baseTypes';

/**
 * Type for table names that exist in our database schema
 */
export type ValidTableName = ExistingTableName;

/**
 * List of existing tables in the database
 */
const existingTables = [
  'flyer_jobs',
  'postcard_jobs', 
  'business_card_jobs',
  'poster_jobs',
  'sleeve_jobs',
  'box_jobs',
  'cover_jobs',
  'sticker_jobs',
  'batches',
  'profiles',
  'user_roles',
  'product_pages' // Added product_pages table
];

/**
 * Validates if the table name exists in our database schema
 */
export function isExistingTable(tableName: string): tableName is ValidTableName {
  return existingTables.includes(tableName);
}
