
// Re-export user service functionality in a standardized way
import { checkUserIsAdmin } from './auth/authService';

export * from './user';
export { checkUserIsAdmin };
