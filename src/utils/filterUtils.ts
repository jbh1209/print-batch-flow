
/**
 * Helper utility functions for data filtering and access control
 */

/**
 * This function returns true because we're allowing all users to access all data,
 * except for admin features which are controlled via AdminProtectedRoute.
 * 
 * In the future, this could be extended to support more granular access control,
 * based on user roles, teams, or other criteria.
 */
export const userCanAccessResource = (): boolean => {
  return true;
};

/**
 * Ensures that a value exists and falls back to a default if it doesn't
 */
export const ensureValue = <T>(value: T | null | undefined, defaultValue: T): T => {
  return value === null || value === undefined ? defaultValue : value;
};
