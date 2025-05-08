
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
 * Prepare update parameters with type safety
 */
export const prepareUpdateParams = <T extends Record<string, any>>(params: T): Record<string, any> => {
  return params;
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
 * Process batch data with proper type handling
 */
export const processBatchData = (data: any): any => {
  if (!data || typeof data !== 'object') return null;
  
  // If it's an error object, return null
  if ('error' in data) return null;
  
  return {
    id: toSafeString(data.id),
    name: toSafeString(data.name),
    status: ensureEnumValue(data.status, 'pending'),
    sheets_required: safeNumber(data.sheets_required),
    front_pdf_url: data.front_pdf_url ? toSafeString(data.front_pdf_url) : null,
    back_pdf_url: data.back_pdf_url ? toSafeString(data.back_pdf_url) : null,
    overview_pdf_url: data.overview_pdf_url ? toSafeString(data.overview_pdf_url) : null,
    due_date: toSafeString(data.due_date),
    created_at: toSafeString(data.created_at),
    created_by: toSafeString(data.created_by),
    updated_at: toSafeString(data.updated_at),
    lamination_type: ensureEnumValue(data.lamination_type, 'none'),
    paper_type: data.paper_type ? toSafeString(data.paper_type) : undefined,
    paper_weight: data.paper_weight ? toSafeString(data.paper_weight) : undefined,
    sheet_size: data.sheet_size ? toSafeString(data.sheet_size) : undefined,
    printer_type: data.printer_type ? toSafeString(data.printer_type) : undefined
  };
};

/**
 * Process job data with type safety
 */
export const processJobData = <T extends Record<string, any>>(data: any): T | null => {
  if (!data || typeof data !== 'object') return null;
  if ('error' in data) return null;
  
  const processedData: Record<string, any> = {};
  
  // Extract all properties safely
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = data[key];
      
      if (key === 'id' || key === 'user_id' || key === 'batch_id') {
        processedData[key] = toSafeString(value);
      } else if (typeof value === 'number') {
        processedData[key] = value;
      } else if (typeof value === 'boolean') {
        processedData[key] = value;
      } else if (value === null) {
        processedData[key] = null;
      } else {
        processedData[key] = toSafeString(value);
      }
    }
  }
  
  return processedData as T;
};

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
 * Creates a database filter that safely handles UUID values
 * Use this for any .eq() operation with UUIDs
 */
export const createUuidFilter = (columnName: string, value: string | undefined) => {
  return { [columnName]: castToUUID(value) };
};

/**
 * Type-safe partial update helper
 */
export const createPartialUpdate = <T extends Record<string, any>>(updates: Partial<T>): Record<string, any> => {
  return updates as Record<string, any>;
};

/**
 * Convert a database batch result to typed BaseBatch object
 */
export const toBatch = (data: any) => {
  return processBatchData(data);
};

/**
 * Convert DB results to a typed Job array
 */
export const toJobArray = <T>(data: any): T[] => {
  if (!data || !Array.isArray(data)) return [];
  
  return data
    .filter(item => item && typeof item === 'object' && !('error' in item))
    .map(item => processJobData<T>(item))
    .filter((item): item is T => item !== null);
};

/**
 * Check if a value has a specific property safely
 */
export const hasProperty = <T extends string>(obj: any, prop: T): boolean => {
  return obj && typeof obj === 'object' && prop in obj;
};
