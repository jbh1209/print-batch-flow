
import { useAuth } from '@/contexts/AuthContext';

// Enhanced hook that properly supports preview mode
// Re-export for backward compatibility
export { useAuth };

// Export the AuthProvider for direct usage
export { AuthProvider } from '@/contexts/AuthContext';

/**
 * This is a wrapper around the AuthContext's useAuth hook
 * It ensures consistent authentication behavior across the application
 * and provides proper preview mode support
 */
