
/**
 * Centralized Security Service 
 * 
 * Provides unified security operations for authentication, authorization,
 * and secure data access across development and production environments.
 */

// Re-export all security-related functions from their respective modules
export { verifyUserRole } from './core/authVerification';
export { getSecureCurrentUser } from './core/userAccess';
export { cleanupAuthState, secureSignOut } from './core/sessionManagement';
export { secureGetAllUsers } from './core/userFetch';
