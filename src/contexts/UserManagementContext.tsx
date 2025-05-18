
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { UserFormData, UserWithRole } from '@/types/user-types';
import * as userService from '@/services/userService';
import { useAuth } from '@/hooks/useAuth';

interface UserManagementContextType {
  users: UserWithRole[];
  isLoading: boolean;
  error: string | null;
  anyAdminExists: boolean;
  fetchUsers: () => Promise<void>;
  createUser: (userData: UserFormData) => Promise<void>;
  updateUser: (userId: string, userData: UserFormData) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  checkAdminExists: () => Promise<void>;
  addAdminRole: (userId: string) => Promise<void>;
}

const UserManagementContext = createContext<UserManagementContextType>({
  users: [],
  isLoading: false,
  error: null,
  anyAdminExists: false,
  fetchUsers: async () => {},
  createUser: async () => {},
  updateUser: async () => {},
  deleteUser: async () => {},
  checkAdminExists: async () => {},
  addAdminRole: async () => {},
});

export const UserManagementProvider = ({ children }: { children: React.ReactNode }) => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anyAdminExists, setAnyAdminExists] = useState(false);
  const { isAdmin, user } = useAuth();

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) {
      console.log('Not admin, skipping fetchUsers');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Fetching users...');
      const fetchedUsers = await userService.fetchUsers();
      console.log('Users fetched:', fetchedUsers);
      
      if (Array.isArray(fetchedUsers)) {
        setUsers(fetchedUsers);
        
        // If current user isn't in the list, add them with admin role
        if (user && !fetchedUsers.some(u => u.id === user.id)) {
          console.log('Current admin user not in list, adding them');
          const currentAdmin: UserWithRole = {
            id: user.id,
            email: user.email || 'Current admin',
            full_name: null,
            avatar_url: null,
            role: 'admin',
            created_at: null
          };
          setUsers(prev => [...prev, currentAdmin]);
        }
      } else {
        console.warn('Invalid user array returned:', fetchedUsers);
        setUsers([]);
      }
    } catch (error: any) {
      console.error('Error loading users:', error);
      setError(`Error loading users: ${error.message}`);
      toast.error(`Error loading users: ${error.message}`);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, user]);

  // Auto-refresh users when admin status changes
  useEffect(() => {
    console.log('UserManagementContext: isAdmin changed to', isAdmin);
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin, fetchUsers]);

  const checkAdminExists = useCallback(async () => {
    try {
      setError(null);
      const exists = await userService.checkAdminExists();
      console.log('Admin exists:', exists);
      setAnyAdminExists(exists);
    } catch (error: any) {
      console.error('Error checking admin existence:', error);
      setError(`Error checking if admin exists: ${error.message}`);
      setAnyAdminExists(false);
    }
  }, []);

  const createUser = useCallback(async (userData: UserFormData) => {
    try {
      await userService.createUser(userData);
      toast.success('User created successfully');
      // Immediately fetch users to update the list
      await fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(`Error creating user: ${error.message}`);
      throw error;
    }
  }, [fetchUsers]);

  const updateUser = useCallback(async (userId: string, userData: UserFormData) => {
    try {
      await userService.updateUserProfile(userId, userData);
      toast.success('User updated successfully');
      await fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(`Error updating user: ${error.message}`);
      throw error;
    }
  }, [fetchUsers]);

  const deleteUser = useCallback(async (userId: string) => {
    if (!userId) {
      toast.error('Invalid user ID');
      return;
    }
    
    try {
      await userService.revokeUserAccess(userId);
      toast.success('User role revoked successfully');
      await fetchUsers();
    } catch (error: any) {
      console.error('Error removing user role:', error);
      toast.error(`Error removing user role: ${error.message}`);
      throw error;
    }
  }, [fetchUsers]);

  const addAdminRole = useCallback(async (userId: string) => {
    if (!userId) {
      toast.error('Invalid user ID');
      return;
    }
    
    try {
      await userService.addAdminRole(userId);
      toast.success('Admin role successfully assigned');
      setAnyAdminExists(true);
      // Reload the page after a short delay to show the updated UI
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      console.error('Error setting admin role:', error);
      toast.error(`Failed to set admin role: ${error.message}`);
      throw error;
    }
  }, []);

  const value = {
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

  return (
    <UserManagementContext.Provider value={value}>
      {children}
    </UserManagementContext.Provider>
  );
};

export const useUserManagement = () => useContext(UserManagementContext);
