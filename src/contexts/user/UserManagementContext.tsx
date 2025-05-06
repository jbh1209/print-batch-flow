
import React, { createContext, useContext } from 'react';
import { UserFormData, UserWithRole } from '@/types/user-types';
import { useUserManagementState } from './useUserManagementState';

// Define the User Management Context Type
export interface UserManagementContextType {
  users: UserWithRole[];
  isLoading: boolean;
  error: string | null;
  anyAdminExists: boolean;
  fetchUsers: () => Promise<void>;
  createUser: (userData: UserFormData) => Promise<void>;
  updateUser: (userId: string, userData: UserFormData) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  checkAdminExists: () => Promise<boolean>;
  addAdminRole: (userId: string) => Promise<void>;
}

// Create the context with default values
const UserManagementContext = createContext<UserManagementContextType>({
  users: [],
  isLoading: false,
  error: null,
  anyAdminExists: false,
  fetchUsers: async () => {},
  createUser: async () => {},
  updateUser: async () => {},
  deleteUser: async () => {},
  checkAdminExists: async () => false,
  addAdminRole: async () => {},
});

// Provider component
export const UserManagementProvider = ({ children }: { children: React.ReactNode }) => {
  // Use the custom hook to get all state and methods
  const userManagementState = useUserManagementState();

  return (
    <UserManagementContext.Provider value={userManagementState}>
      {children}
    </UserManagementContext.Provider>
  );
};

// Custom hook to use the context
export const useUserManagement = () => useContext(UserManagementContext);
