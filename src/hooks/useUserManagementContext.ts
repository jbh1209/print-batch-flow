
import { useContext } from 'react';
import { UserManagementContext } from '@/providers/UserManagementProvider';

/**
 * Custom hook to use the user management context
 */
export function useUserManagementContext() {
  const context = useContext(UserManagementContext);
  
  if (context === undefined) {
    throw new Error('useUserManagementContext must be used within a UserManagementProvider');
  }
  
  return context;
}
