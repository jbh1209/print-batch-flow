
import { createContext, useContext, ReactNode, useState } from 'react';
import { UserFormData, UserWithRole } from '@/types/user-types';
import { useAuth } from '@/hooks/useAuth';
import { useCallback } from 'react';

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
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anyAdminExists, setAnyAdminExists] = useState(false);
  const { isAdmin } = useAuth();

  // Placeholder for fetching user data - this is ONLY called manually from the Users page
  const fetchUsers = useCallback(async () => {
    if (!isAdmin) {
      console.log('Not admin, skipping fetchUsers in context');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const { fetchUsers } = await import('@/services/user/userFetchService');
      const loadedUsers = await fetchUsers();
      
      setUsers(loadedUsers);
      console.log(`Successfully loaded ${loadedUsers.length} users on explicit request`);
    } catch (error: any) {
      console.error('Error loading users:', error);
      setError(`Failed to load users: ${error.message || 'Unknown error'}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  // Simple stub functions that will be implemented only when called from the Users page
  const createUser = useCallback(async (userData: UserFormData) => {
    setError(null);
    const { createUser } = await import('@/services/user');
    await createUser(userData);
    await fetchUsers();
  }, [fetchUsers]);

  const updateUser = useCallback(async (userId: string, userData: UserFormData) => {
    setError(null);
    const { updateUser } = await import('@/services/user');
    await updateUser(userId, userData);
    await fetchUsers();
  }, [fetchUsers]);

  const deleteUser = useCallback(async (userId: string) => {
    setError(null);
    const { deleteUser } = await import('@/services/user');
    await deleteUser(userId);
    await fetchUsers();
  }, [fetchUsers]);

  const checkAdminExists = useCallback(async () => {
    try {
      const { checkAdminExists } = await import('@/services/user');
      const exists = await checkAdminExists();
      setAnyAdminExists(exists);
      return exists;
    } catch (error: any) {
      console.error('Error checking admin existence:', error);
      setError(error.message || "Failed to check admin status");
      return false;
    }
  }, []);

  const addAdminRole = useCallback(async (userId: string) => {
    setError(null);
    const { addAdminRole } = await import('@/services/user');
    await addAdminRole(userId);
    await checkAdminExists();
    await fetchUsers();
  }, [fetchUsers, checkAdminExists]);

  return (
    <UserManagementContext.Provider
      value={{
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
