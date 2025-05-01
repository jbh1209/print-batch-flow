
import React, { createContext, useState, useContext, ReactNode } from 'react';
import { userService } from '@/services/userService';
import { User, UserFormData } from '@/types/user-types';

interface UserOperationsContextType {
  processing: boolean;
  addUser: (userData: UserFormData) => Promise<boolean>;
  editUser: (userId: string, userData: UserFormData, currentRole?: string) => Promise<boolean>;
  deleteUser: (userId: string, currentUserId?: string) => Promise<boolean>;
  toggleAdminRole: (userId: string, currentRole: string, currentUserId?: string) => Promise<boolean>;
}

const UserOperationsContext = createContext<UserOperationsContextType | undefined>(undefined);

export function UserOperationsProvider({ 
  children,
  refreshUsers 
}: { 
  children: ReactNode,
  refreshUsers: () => Promise<void>
}) {
  const [processing, setProcessing] = useState(false);

  // Add user handler
  const addUser = async (userData: UserFormData) => {
    setProcessing(true);
    try {
      const success = await userService.createUser(userData);
      if (success) {
        await refreshUsers();
      }
      return success;
    } finally {
      setProcessing(false);
    }
  };

  // Edit user handler
  const editUser = async (userId: string, userData: UserFormData, currentRole?: string) => {
    setProcessing(true);
    try {
      const success = await userService.updateUser(userId, userData, currentRole);
      if (success) {
        await refreshUsers();
      }
      return success;
    } finally {
      setProcessing(false);
    }
  };

  // Delete user handler
  const deleteUser = async (userId: string, currentUserId?: string) => {
    setProcessing(true);
    try {
      const success = await userService.deleteUser(userId, currentUserId);
      if (success) {
        await refreshUsers();
      }
      return success;
    } finally {
      setProcessing(false);
    }
  };

  // Toggle admin role handler
  const toggleAdminRole = async (userId: string, currentRole: string, currentUserId?: string) => {
    setProcessing(true);
    try {
      const success = await userService.toggleAdminRole(userId, currentRole, currentUserId);
      if (success) {
        await refreshUsers();
      }
      return success;
    } finally {
      setProcessing(false);
    }
  };

  return (
    <UserOperationsContext.Provider 
      value={{ 
        processing, 
        addUser, 
        editUser, 
        deleteUser,
        toggleAdminRole
      }}
    >
      {children}
    </UserOperationsContext.Provider>
  );
}

export function useUserOperations() {
  const context = useContext(UserOperationsContext);
  if (context === undefined) {
    throw new Error('useUserOperations must be used within a UserOperationsProvider');
  }
  return context;
}
