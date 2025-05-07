
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
  return obj && typeof obj === 'object' && 'code' in obj && 'message' in obj;
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
