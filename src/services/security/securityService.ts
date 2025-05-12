
/**
 * Centralized Security Service 
 * 
 * Provides unified security operations for authentication, authorization,
 * and secure data access across development and production environments.
 * 
 * This is the main entry point for all security-related operations.
 */

// Re-export all security-related functions from their respective modules
export { verifyUserRole } from './core/authVerification';
export { getSecureCurrentUser } from './core/userAccess';
export { cleanupAuthState, secureSignOut } from './core/sessionManagement';
export { secureGetAllUsers } from './core/userFetch';

// Add new functions as needed to provide a comprehensive security API

/**
 * Version information for security service
 * Used for debugging and ensuring proper imports
 */
export const SECURITY_SERVICE_VERSION = '2.0.0';
