
/**
 * Hook to use the AuthContext
 */
import { useContext } from 'react'; 
import { AuthContext } from '@/contexts/AuthContext';

export const useAuth = () => useContext(AuthContext);

export default useAuth;
