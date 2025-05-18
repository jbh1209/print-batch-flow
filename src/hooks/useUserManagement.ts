
import { useAuth } from '@/contexts/AuthContext';
import { useUserManagementState } from './user-management/useUserManagementState';
import { useAdminCheck } from './user-management/useAdminCheck';
import { useUserFetching } from './user-management/useUserFetching';
import { useUserCreation } from './user-management/useUserCreation';
import { useUserUpdate } from './user-management/useUserUpdate';
import { useUserDeletion } from './user-management/useUserDeletion';
import { useAdminRoleAssignment } from './user-management/useAdminRoleAssignment';

/**
 * Hook for user management operations
 */
export function useUserManagement() {
  const { isAdmin, session } = useAuth();
  
  const {
    users,
    setUsers,
    isLoading,
    setIsLoading,
    error,
    setError,
    anyAdminExists,
    setAnyAdminExists
  } = useUserManagementState();
  
  const { checkAdminExists } = useAdminCheck(setError, setAnyAdminExists);
  
  const { fetchUsers } = useUserFetching(
    isAdmin,
    session,
    setUsers,
    setIsLoading,
    setError
  );
  
  const { createUser } = useUserCreation(session, fetchUsers);
  const { updateUser } = useUserUpdate(session, fetchUsers);
  const { deleteUser } = useUserDeletion(session, fetchUsers);
  
  const { addAdminRole } = useAdminRoleAssignment(
    session,
    setAnyAdminExists,
    fetchUsers
  );

  return {
    users,
    isLoading,
    error,
    anyAdminExists,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    checkAdminExists,
    addAdminRole,
  };
}
