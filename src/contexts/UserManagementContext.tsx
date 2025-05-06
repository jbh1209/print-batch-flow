import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { UserFormData, UserWithRole } from '@/types/user-types';
import * as userService from '@/services/user';
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
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const CACHE_DURATION = 20000; // 20 seconds cache duration
  
  const fetchUsers = useCallback(async (forceFetch = false) => {
    if (!isAdmin && !forceFetch) {
      console.log('Not admin and not forced fetch, skipping fetchUsers');
      setIsLoading(false);
      return;
    }
    
    // Use cache unless force refresh is requested
    const now = Date.now();
    if (!forceFetch && now - lastFetchTime < CACHE_DURATION && users.length > 0) {
      console.log('Using cached user data from', new Date(lastFetchTime).toLocaleTimeString());
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Fetching users at', new Date().toLocaleTimeString());
      const fetchedUsers = await userService.fetchUsers();
      console.log('Users fetched:', fetchedUsers.length);
      
      if (Array.isArray(fetchedUsers)) {
        // Sort users by name for better UI experience
        const sortedUsers = [...fetchedUsers].sort((a, b) => {
          // Sort by name if available, otherwise email
          const nameA = a.full_name || a.email || '';
          const nameB = b.full_name || b.email || '';
          return nameA.localeCompare(nameB);
        });
        
        setUsers(sortedUsers);
        setLastFetchTime(now);
      } else {
        console.warn('Invalid user array returned:', fetchedUsers);
        setUsers([]);
      }
    } catch (error: any) {
      console.error('Error loading users:', error);
      const errorMsg = error.message || 'Unknown error'; 
      setError(`Error loading users: ${errorMsg}`);
      toast.error(`Error loading users: ${errorMsg}. Please try again later.`);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, users.length, lastFetchTime]);

  // Auto-refresh users when admin status changes or component mounts
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
      // Immediately fetch users to update the list
      await fetchUsers(true); // Force refresh after creation
    } catch (error: any) {
      console.error('Error creating user:', error);
      throw error;
    }
  }, [fetchUsers]);

  const updateUser = useCallback(async (userId: string, userData: UserFormData) => {
    try {
      await userService.updateUserProfile(userId, userData);
      // Critical: Re-fetch users to refresh the UI with updated data
      await fetchUsers(true); // Force refresh after update
    } catch (error: any) {
      console.error('Error updating user:', error);
      throw error;
    }
  }, [fetchUsers]);

  const deleteUser = useCallback(async (userId: string) => {
    if (!userId) {
      throw new Error('Invalid user ID');
    }
    
    try {
      await userService.revokeUserAccess(userId);
      await fetchUsers(true); // Force refresh after deletion
    } catch (error: any) {
      console.error('Error removing user role:', error);
      throw error;
    }
  }, [fetchUsers]);

  const addAdminRole = useCallback(async (userId: string) => {
    if (!userId) {
      throw new Error('Invalid user ID');
    }
    
    try {
      await userService.addAdminRole(userId);
      setAnyAdminExists(true);
      // Reload the page after a short delay to show the updated UI
      toast.success('Admin role successfully assigned');
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      console.error('Error setting admin role:', error);
      throw error;
    }
  }, []);

  const value = {
    users,
    isLoading,
    error,
    anyAdminExists,
    fetchUsers: () => fetchUsers(true), // Expose the fetch with force refresh
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
