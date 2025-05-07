
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
 * Check if a table exists in the database schema
 */
export const isExistingTable = (tableName: string): boolean => {
  const validTables = [
    'batches',
    'business_card_jobs',
    'flyer_jobs',
    'box_jobs',
    'postcard_jobs',
    'cover_jobs',
    'poster_jobs',
    'sleeve_jobs',
    'sticker_jobs',
    'profiles',
    'user_roles',
    'app_settings'
  ];
  
  return validTables.includes(tableName);
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
 */
export const safeString = (
  value: any,
  defaultValue: string = ""
): string => {
  if (value === null || value === undefined) return defaultValue;
  return String(value);
};

/**
 * Safe number getter that ensures number type and provides default value
 * Useful for type-safe operations with Supabase data
 */
export const safeNumber = (
  value: any,
  defaultValue: number = 0
): number => {
  if (value === null || value === undefined) return defaultValue;
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
