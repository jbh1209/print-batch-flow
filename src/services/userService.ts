
// Re-export user service functionality in a standardized way
import { checkUserIsAdmin } from './auth/authService';

// Export all functions from the user module
export * from './user';

// Export auth-related functions
export { checkUserIsAdmin };
