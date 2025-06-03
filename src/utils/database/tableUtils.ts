
import { ExistingTableName } from '@/config/productTypes';

export const existingTables: ExistingTableName[] = [
  'flyer_jobs',
  'postcard_jobs', 
  'business_card_jobs',
  'poster_jobs',
  'sleeve_jobs',
  'box_jobs',
  'cover_jobs',
  'sticker_jobs'
];

export function isExistingTable(tableName: string): tableName is ExistingTableName {
  return existingTables.includes(tableName as ExistingTableName);
}
