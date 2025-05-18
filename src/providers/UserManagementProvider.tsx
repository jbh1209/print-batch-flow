
import { createContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';
import { Session } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { UserFormData, UserWithRole } from '@/types/user-types';
import { useUserManagementState } from '@/hooks/user-management/useUserManagementState';
import { useUserFetching } from '@/hooks/user-management/useUserFetching';
import { useUserCreation } from '@/hooks/user-management/useUserCreation';
import { useUserUpdate } from '@/hooks/user-management/useUserUpdate';
import { useUserDeletion } from '@/hooks/user-management/useUserDeletion';
import { useAdminRoleAssignment } from '@/hooks/user-management/useAdminRoleAssignment';
import { useAdminCheck } from '@/hooks/user-management/useAdminCheck';
import { useAdminExistence } from '@/hooks/user-management/useAdminExistence';

// Define context type
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

// Create context with default values
export const UserManagementContext = createContext<UserManagementContextType>({
  users: [],
  isLoading: false,
  error: null,
  anyAdminExists: false,
  fetchUsers: async () => {},
  createUser: async () => {},
  updateUser: async () => {},
  deleteUser: async () => {},
  addAdminRole: async () => {},
  checkAdminExists: async () => false,
});

export const UserManagementProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAdmin, session } = useAuth();
  
  const {
    users, setUsers,
    isLoading, setIsLoading,
    error, setError,
    anyAdminExists, setAnyAdminExists
  } = useUserManagementState();
  
  // Initialize hooks with necessary dependencies
  const { checkAdminExists } = useAdminExistence();
  const { fetchUsers } = useUserFetching(isAdmin, session, setUsers, setIsLoading, setError);
  const { createUser } = useUserCreation(session, fetchUsers);
  const { updateUser } = useUserUpdate(session, fetchUsers);
  const { deleteUser } = useUserDeletion(session, fetchUsers);
  const { addAdminRole } = useAdminRoleAssignment(session, setAnyAdminExists, fetchUsers);
  
  // Check admin status when system initializes
  const adminCheck = useAdminCheck(setError, setAnyAdminExists);

  // Load users on mount if user is admin and session exists
  useEffect(() => {
    if (user && isAdmin && session?.access_token) {
      fetchUsers();
      adminCheck.checkAdminExists();
    }
  }, [user, isAdmin, session?.access_token]);

  // Create context value
  const contextValue: UserManagementContextType = {
    users,
    isLoading,
    error,
    anyAdminExists,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    addAdminRole,
    checkAdminExists: adminCheck.checkAdminExists
  };

  return (
    <UserManagementContext.Provider value={contextValue}>
      {children}
    </UserManagementContext.Provider>
  );
};
