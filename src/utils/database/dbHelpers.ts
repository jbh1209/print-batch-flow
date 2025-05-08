
/**
 * Utility functions to handle database operations with proper type handling
 */

/**
 * Helper to cast string values to UUID type for Supabase operations
 * This helps with TypeScript's strict type checking for UUID values
 */
export const castToUUID = (id: string | undefined) => {
  // Allow undefined for optional parameters
  if (id === undefined) return undefined;
  return id as unknown as never;
};

/**
 * Helper to safely access properties from potentially undefined or error objects
 * Useful when handling database query results
 * 
 * @param obj The object to safely access properties from
 * @param key The key to access
 * @param defaultValue Optional default value if property doesn't exist
 * @returns The property value or undefined/defaultValue
 */
export const safeGet = <T, K extends keyof T>(
  obj: T | null | undefined, 
  key: K, 
  defaultValue?: T[K]
): T[K] | undefined => {
  if (!obj) return defaultValue;
  try {
    return obj[key] !== null && obj[key] !== undefined ? obj[key] : defaultValue;
  } catch (err) {
    console.error(`Error accessing ${String(key)}:`, err);
    return defaultValue;
  }
};

/**
 * Check if a value is a valid PostgreSQL UUID
 */
export const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * Type guard to check if an object is a database error
 */
export const isDatabaseError = (obj: any): boolean => {
  return obj && typeof obj === 'object' && 'error' in obj;
};

/**
 * Prepare database update parameters with type safety
 * This function helps with TypeScript's strict type checking for database operations
 */
export const prepareUpdateParams = <T extends Record<string, any>>(params: T): any => {
  return params as any;
};

/**
 * Format a filter condition for Supabase queries
 */
export const formatFilterCondition = (column: string, value: any): { [key: string]: any } => {
  return { [column]: value };
};

/**
 * Helper to check if a response contains data
 */
export const hasData = <T>(response: { data: T | null }): response is { data: T } => {
  return response.data !== null;
};

/**
 * Safe string getter that ensures string type and provides default value
 * Useful for type-safe operations with Supabase data
 * 
 * This function will safely handle any SelectQueryError types
 */
export const safeString = (
  value: any,
  defaultValue: string = ""
): string => {
  // Handle special case for SelectQueryError
  if (value === null || value === undefined || 
      (typeof value === 'object' && 'error' in value)) {
    return defaultValue;
  }
  return String(value);
};

/**
 * Safe number getter that ensures number type and provides default value
 * Useful for type-safe operations with Supabase data
 * 
 * This function will safely handle any SelectQueryError types
 */
export const safeNumber = (
  value: any,
  defaultValue: number = 0
): number => {
  // Handle special case for SelectQueryError
  if (value === null || value === undefined || 
      (typeof value === 'object' && 'error' in value)) {
    return defaultValue;
  }
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};

/**
 * Convert an object to a properly typed database insert/update payload
 * This ensures that all properties have the right types for database operations
 */
export const toDbPayload = <T extends Record<string, any>>(obj: T): any => {
  return obj as any;
};

/**
 * Safely extract a property from a potentially error object
 * Useful when dealing with Supabase query results that might be error objects
 */
export const safeExtract = <T>(obj: any, key: string, defaultValue: T): T => {
  // Check if the object is an error object (like SelectQueryError)
  if (!obj || (typeof obj === 'object' && 'error' in obj)) {
    return defaultValue;
  }
  
  try {
    const value = obj[key];
    return value !== null && value !== undefined ? value : defaultValue;
  } catch (err) {
    console.error(`Error extracting ${key}:`, err);
    return defaultValue;
  }
};

/**
 * Safely handle a potentially error-containing database result
 * @param data The data to process
 * @param defaultValue The default value to return if data is an error or falsy
 * @param processor Optional function to process valid data
 * @returns Processed data or default value
 */
export const safeDbResult = <T, R = T>(
  data: any, 
  defaultValue: R,
  processor?: (validData: any) => R
): R => {
  // Handle null, undefined or error cases
  if (!data || (typeof data === 'object' && 'error' in data)) {
    return defaultValue;
  }
  
  try {
    if (processor) {
      return processor(data);
    }
    return data as unknown as R;
  } catch (err) {
    console.error('Error processing database result:', err);
    return defaultValue;
  }
};

/**
 * Safe check for objects that might be error types
 * @param obj Object to check
 * @returns true if the object is valid (not an error)
 */
export const isValidDbObject = (obj: any): boolean => {
  return obj && typeof obj === 'object' && !('error' in obj);
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
    .map((item) => mapper(item));
};

/**
 * Convert any value from a database query to a string safely
 */
export const toSafeString = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    if ('error' in value) {
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
 * Extract data from a Supabase response with proper error handling
 */
export const extractData = <T>(response: { data: T | null; error: any }): T | null => {
  if (response.error) {
    console.error("Database error:", response.error);
    return null;
  }
  return response.data;
};

/**
 * Convert a database result to a strongly typed object
 */
export const asBatchData = (data: any): Record<string, string | number | null | boolean> => {
  if (!data || typeof data !== 'object') {
    return {};
  }
  
  const result: Record<string, string | number | null | boolean> = {};
  
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = data[key];
      
      // Skip error objects
      if (value && typeof value === 'object' && 'error' in value) {
        result[key] = null;
        continue;
      }
      
      // Convert values to appropriate types
      if (typeof value === 'number') {
        result[key] = value;
      } else if (typeof value === 'boolean') {
        result[key] = value;
      } else if (value === null) {
        result[key] = null;
      } else {
        result[key] = String(value);
      }
    }
  }
  
  return result;
};

/**
 * Type guard to check if an object is a SelectQueryError
 */
export const isSelectQueryError = (obj: any): boolean => {
  return obj && typeof obj === 'object' && 'error' in obj;
};

/**
 * Process database result with safety checks for each field
 * @param data Raw data from database
 * @returns Object with processed values
 */
export const processDbFields = <T extends Record<string, any>>(data: any): T => {
  if (!data || typeof data !== 'object' || isSelectQueryError(data)) {
    return {} as T;
  }
  
  const result: Record<string, any> = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = data[key];
      result[key] = isSelectQueryError(value) ? null : value;
    }
  }
  
  return result as T;
};

/**
 * Ensure a value is cast to the correct enum type
 * @param value The string value to convert
 * @param defaultValue The default enum value if conversion fails
 * @returns The correctly typed enum value
 */
export function ensureEnumValue<T extends string>(value: any, defaultValue: T): T {
  if (typeof value === 'string') {
    return value as T;
  }
  return defaultValue;
}

/**
 * Process database results with proper type handling for batch operations
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
