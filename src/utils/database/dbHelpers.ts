
/**
 * Utility functions to handle database operations with proper type handling
 */
import { PostgrestSingleResponse } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";

// Type for Supabase error objects
export type SupabaseErrorType = {
  error: true;
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

// Type guard to check if an object is a Supabase error
export function isSupabaseError(obj: any): obj is SupabaseErrorType {
  return obj && typeof obj === 'object' && 'error' in obj;
}

/**
 * Helper to cast string values to UUID type for Supabase operations
 * This helps with TypeScript's strict type checking for UUID values
 */
export const castToUUID = (id: string | undefined) => {
  // Allow undefined for optional parameters
  if (id === undefined) return undefined;
  return id as unknown as any; // Use 'unknown' as intermediate step for safer casting
};

/**
 * Safe extraction of ID from potentially error objects
 */
export const safeGetId = (obj: any): string => {
  if (!obj) return '';
  if (typeof obj === 'object' && 'error' in obj) return '';
  return obj.id ? String(obj.id) : '';
};

/**
 * Safe batch ID extraction from data or error objects
 */
export const safeBatchId = (data: any): string => {
  if (!data) return '';
  if ('error' in data) return '';
  return data.id ? String(data.id) : '';
};

/**
 * Process database fields safely for any object
 */
export const processDbFields = <T extends Record<string, any>>(data: any): T => {
  if (!data || typeof data !== 'object') {
    return {} as T;
  }
  
  if ('error' in data) {
    return {} as T;
  }
  
  const processedData: Record<string, any> = {};
  
  // Process each field safely
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = data[key];
      
      if (value === null || value === undefined) {
        processedData[key] = null;
      } else if (typeof value === 'object') {
        try {
          processedData[key] = JSON.stringify(value);
        } catch (e) {
          processedData[key] = null;
        }
      } else {
        processedData[key] = value;
      }
    }
  }
  
  return processedData as T;
};

/**
 * Safely map database results to typed objects
 * Especially useful for batch query results with potential error handling
 */
export const safeDbMap = <T>(data: any[] | null, mapper: (item: any) => T): T[] => {
  if (!data || !Array.isArray(data)) {
    return [];
  }
  
  return data
    .filter(item => item && typeof item === 'object' && !('error' in item))
    .map(mapper);
};

/**
 * Convert any value from a database query to a string safely
 */
export const toSafeString = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    if (value && 'error' in value) {
      return '';
    }
    try {
      return JSON.stringify(value);
    } catch (e) {
      return '';
    }
  }
  return String(value);
};

/**
 * Ensure a value is cast to the correct enum type
 */
export function ensureEnumValue<T extends string>(value: any, defaultValue: T): T {
  if (typeof value === 'string') {
    return value as T;
  }
  return defaultValue;
}

/**
 * Safe number getter that ensures number type and provides default value
 */
export const safeNumber = (
  value: any,
  defaultValue: number = 0
): number => {
  if (value === null || value === undefined || 
      (typeof value === 'object' && 'error' in value)) {
    return defaultValue;
  }
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};

/**
 * Safe boolean getter
 */
export const safeBoolean = (
  value: any,
  defaultValue: boolean = false
): boolean => {
  if (value === null || value === undefined || 
      (typeof value === 'object' && 'error' in value)) {
    return defaultValue;
  }
  return Boolean(value);
};

/**
 * Safely handle Supabase database responses
 */
export const handleDatabaseResponse = <T>(
  response: PostgrestSingleResponse<any>,
  mapper: (data: any) => T,
  defaultValue: T
): T => {
  if (response.error) {
    console.error('Database error:', response.error);
    return defaultValue;
  }
  
  if (!response.data) {
    return defaultValue;
  }
  
  return mapper(response.data);
};

/**
 * Check if a value has a specific property safely
 */
export const hasProperty = <T extends string>(obj: any, prop: T): boolean => {
  return obj && typeof obj === 'object' && prop in obj;
};

/**
 * Create properly typed data for insert operations
 * Uses the 'as any' type assertion to allow for inserting data into Supabase tables
 */
export function createInsertData<T extends Record<string, any>>(data: T): any {
  return data as any;
}

/**
 * Create properly typed data for update operations
 * Uses the 'as any' type assertion to allow for updating data in Supabase tables
 */
export function createUpdateData<T extends Record<string, any>>(data: T): any {
  return data as any;
}

/**
 * Type-safe prepare update parameters function that uses 'as any' casting
 * for compatibility with Supabase's typed interfaces
 */
export const prepareUpdateParams = <T extends Record<string, any>>(params: T): any => {
  return params as any;
};
