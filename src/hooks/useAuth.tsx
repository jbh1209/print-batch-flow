
import { useContext } from 'react';
import { AuthContext } from './auth/AuthContext';

export const useAuth = () => {
  return useContext(AuthContext);
};

export { AuthProvider } from './auth/AuthProvider';
