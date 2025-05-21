
/**
 * Type for existing table names to ensure only valid tables are used
 */
export type ExistingTableName = 
  | "business_card_jobs"
  | "flyer_jobs"
  | "box_jobs"
  | "postcard_jobs"
  | "poster_jobs"
  | "cover_jobs"
  | "sleeve_jobs"
  | "sticker_jobs"
  | "batches";

/**
 * Check if a table name exists in our database schema
 * @param tableName The table name to check
 * @returns boolean indicating whether the table exists
 */
export const isExistingTable = (tableName: string): tableName is ExistingTableName => {
  const validTables: ExistingTableName[] = [
    "business_card_jobs",
    "flyer_jobs",
    "box_jobs",
    "postcard_jobs",
    "poster_jobs",
    "cover_jobs",
    "sleeve_jobs",
    "sticker_jobs",
    "batches"
  ];
  return validTables.includes(tableName as ExistingTableName);
};
