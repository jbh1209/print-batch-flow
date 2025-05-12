
import { createContext, useContext, ReactNode, useEffect } from 'react';
import { UserFormData, UserWithRole } from '@/types/user-types';
import { useAuth } from '@/hooks/useAuth';
import { useUserFetching } from '@/hooks/user/useUserFetching';
import { useUserCreation } from '@/hooks/user/useUserCreation';
import { useUserModification } from '@/hooks/user/useUserModification';
import { useAdminChecks } from '@/hooks/user/useAdminChecks';

interface UserManagementContextType {
  users: UserWithRole[];
  isLoading: boolean;
  error: string | null;
  anyAdminExists: boolean;
  fetchUsers: () => Promise<void>;
  createUser: (userData: UserFormData) => Promise<void>;
  updateUser: (userId: string, userData: UserFormData) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  addAdminRole: (userId: string) => Promise<void>;
  checkAdminExists: () => Promise<boolean>;
}

const UserManagementContext = createContext<UserManagementContextType | undefined>(undefined);

export const UserManagementProvider = ({ children }: { children: ReactNode }) => {
  const { isAdmin } = useAuth();
  const { users, isLoading, error, fetchUsers, setUsers } = useUserFetching();
  const { createUser } = useUserCreation(fetchUsers, setUsers);
  const { updateUser, deleteUser } = useUserModification(fetchUsers);
  const { 
    anyAdminExists, 
    error: adminError, 
    checkAdminExists, 
    addAdminRole, 
    setError 
  } = useAdminChecks(fetchUsers);

  // Sync errors between hooks
  useEffect(() => {
    if (error) {
      setError(error);
    }
  }, [error, setError]);

  // Effect for initial data loading
  useEffect(() => {
    // Check if any admin exists on component mount
    checkAdminExists().catch(console.error);
    
    // Load users if admin
    if (isAdmin) {
      fetchUsers().catch(console.error);
    }
  }, [checkAdminExists, fetchUsers, isAdmin]);

  return (
    <UserManagementContext.Provider
      value={{
        users,
        isLoading,
        error: error || adminError,
        anyAdminExists,
        fetchUsers,
        createUser,
        updateUser,
        deleteUser,
        checkAdminExists,
        addAdminRole,
      }}
    >
      {children}
    </UserManagementContext.Provider>
  );
};

export const useUserManagement = () => {
  const context = useContext(UserManagementContext);
  if (context === undefined) {
    throw new Error('useUserManagement must be used within a UserManagementProvider');
  }
  return context;
};
