
/**
 * Enhanced User Management Hook with Improved Security
 * Refactored into smaller, more focused hooks
 */
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserFetching } from './user/useUserFetching';
import { useUserCreation } from './user/useUserCreation';
import { useUserModification } from './user/useUserModification';
import { useAdminChecks } from './user/useAdminChecks';

/**
 * Hook for user management operations with enhanced security
 */
export function useUserManagement() {
  const { isAdmin } = useAuth();
  const { users, isLoading, error, fetchUsers, fetchUsersVoid, setUsers } = useUserFetching();
  const { createUser } = useUserCreation(fetchUsersVoid, setUsers);
  const { updateUser, deleteUser } = useUserModification(fetchUsersVoid);
  const { 
    anyAdminExists, 
    error: adminError, 
    checkAdminExists, 
    addAdminRole,
    setError 
  } = useAdminChecks(fetchUsersVoid);

  // Sync errors between hooks
  useEffect(() => {
    if (error) {
      setError(error);
    } else if (adminError) {
      setError(null);
    }
  }, [error, adminError, setError]);

  // Effect for initial data loading
  useEffect(() => {
    // Check if any admin exists on component mount
    checkAdminExists().catch(console.error);
    
    // Load users if admin
    if (isAdmin) {
      fetchUsersVoid().catch(console.error);
    }
  }, [checkAdminExists, fetchUsersVoid, isAdmin]);

  return {
    users,
    isLoading,
    error: error || adminError,
    anyAdminExists,
    fetchUsers: fetchUsersVoid,
    createUser,
    updateUser,
    deleteUser,
    checkAdminExists,
    addAdminRole,
  };
}

// Export a context version for backward compatibility
export { UserManagementProvider, useUserManagement as useUserManagementContext } from '@/contexts/UserManagementContext';
