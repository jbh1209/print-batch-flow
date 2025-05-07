
/**
 * Hook to use the AuthContext
 */
import { useContext } from 'react'; 
import { AuthContext } from '@/contexts/AuthContext';

// Export the useAuth hook directly
export const useAuth = () => useContext(AuthContext);

// Also as default export for backward compatibility
export default useAuth;
