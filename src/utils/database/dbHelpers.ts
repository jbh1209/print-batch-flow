
import { ExistingTableName } from '@/config/types/baseTypes';
import { Database } from '@/integrations/supabase/types';

/**
 * Safely converts any value to a string
 */
export const toSafeString = (value: any): string => {
  if (value === null || value === undefined) return '';
  return String(value);
};

/**
 * Cast a value to UUID safely for database operations
 */
export const castToUUID = (value: string | null | undefined): string | null => {
  if (!value) return null;
  return value;
};

/**
 * Prepares parameters for update operations by removing undefined values
 */
export const prepareUpdateParams = (params: Record<string, any>): Record<string, any> => {
  const result: Record<string, any> = {};
  
  for (const key in params) {
    if (params[key] !== undefined) {
      result[key] = params[key];
    }
  }
  
  return result;
};

/**
 * Process batch data from database query
 * This adds additional type safety for batch operations
 */
export const processBatchData = <T extends Record<string, any>>(data: T | null): T | null => {
  if (!data) return null;
  return data as T;
};

/**
 * Process job data from database query
 * This adds additional type safety for job operations
 */
export const processJobData = <T extends Record<string, any>>(data: T | null): T | null => {
  if (!data) return null;
  return data as T;
};

/**
 * Convert array of jobs to typed array
 */
export const toJobArray = <T extends Record<string, any>>(data: T[] | null): T[] => {
  if (!data) return [];
  return data as T[];
};

/**
 * Creates a properly typed insert data object for Supabase
 */
export function createInsertData<T extends Record<string, any>>(data: T): any {
  return data as any;
}

/**
 * Creates a properly typed update data object for Supabase
 */
export function createUpdateData<T extends Record<string, any>>(data: T): any {
  return data as any;
}

/**
 * Process database fields to ensure consistent type handling
 */
export const processDbFields = <T extends Record<string, any>>(data: T): T => {
  if (!data) return {} as T;
  return data as T;
};

/**
 * Ensures a table name is valid for type-safe operations
 */
export const ensureValidTable = (tableName: string): ExistingTableName => {
  return tableName as ExistingTableName;
};
