
/**
 * Centralized Security Service
 * 
 * Provides unified security operations for authentication, authorization,
 * and secure data access across development and production environments.
 * 
 * This is the main entry point for all security-related operations.
 */

// Re-export security-related functions from their respective modules
export { verifyUserRole } from './core/authVerification';
export { getSecureCurrentUser } from './core/userAccess';
export { cleanupAuthState, secureSignOut } from './core/sessionManagement';
export { fetchUsers, invalidateUserCache } from './core/userFetch';

// Export security validation hooks
export { useSecureSessionValidation } from '@/hooks/useSecureSessionValidation';
export { useSecureJobValidation } from '@/hooks/useSecureJobValidation';

// Export secure route components
export { default as SecureProtectedRoute } from '@/components/auth/SecureProtectedRoute';

/**
 * Version information for security service
 */
export const SECURITY_SERVICE_VERSION = '1.1.0';
