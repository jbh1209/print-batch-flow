
/**
 * Centralized Security Service - Phase 3 Enhancements
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

// Export new PDF security utilities
export { validatePdfAccess, secureGetPdfUrl, logPdfAccess } from '@/utils/pdf/securityUtils';

// Export enhanced validation hooks
export { useSecureJobValidation } from '@/hooks/useSecureJobValidation';
export { useSecureSessionValidation } from '@/hooks/useSecureSessionValidation';

// Export enhanced protected route component
export { default as SecureProtectedRoute } from '@/components/auth/SecureProtectedRoute';

/**
 * Version information for security service
 * Updated for Phase 3 enhancements
 */
export const SECURITY_SERVICE_VERSION = '3.0.0';
