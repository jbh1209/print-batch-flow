
/**
 * Type for table names that exist in our database schema
 */
export type ValidTableName = 
  | 'flyer_jobs'
  | 'postcard_jobs'
  | 'business_card_jobs'
  | 'poster_jobs'
  | 'sleeve_jobs'
  | 'box_jobs'
  | 'cover_jobs'
  | 'sticker_jobs'
  | 'batches'
  | 'profiles'
  | 'user_roles';

/**
 * Validates if the table name exists in our database schema
 */
export function isExistingTable(tableName: string): tableName is ValidTableName {
  // List of existing tables in the database
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
    'user_roles'
  ];
  
  return existingTables.includes(tableName);
}
