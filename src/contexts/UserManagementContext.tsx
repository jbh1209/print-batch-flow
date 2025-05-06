
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
  checkAdminExists: () => Promise<boolean>; // Return type is Promise<boolean>
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
  checkAdminExists: async () => false, // Default return is false
  addAdminRole: async () => {},
});

export const UserManagementProvider = ({ children }: { children: React.ReactNode }) => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anyAdminExists, setAnyAdminExists] = useState(false);
  const { isAdmin, user } = useAuth();
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const CACHE_DURATION = 30000; // 30 seconds cache duration
  
  const fetchUsers = useCallback(async (forceFetch = false) => {
    // Skip fetch if not admin and not forced
    if (!isAdmin && !forceFetch) {
      console.log('Not admin and not forced fetch, skipping fetchUsers');
      setIsLoading(false);
      return;
    }
    
    // Check auth status before proceeding
    if (!user?.id) {
      console.log('No authenticated user, skipping fetchUsers');
      setError('Authentication required');
      setIsLoading(false);
      return;
    }
    
    // Use cache unless force refresh is requested
    const now = Date.now();
    if (!forceFetch && now - lastFetchTime < CACHE_DURATION && users.length > 0) {
      console.log(`Using cached user data from ${new Date(lastFetchTime).toLocaleTimeString()}`);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching users at ${new Date().toLocaleTimeString()}`);
      const fetchedUsers = await userService.fetchUsers();
      
      if (Array.isArray(fetchedUsers)) {
        console.log(`Successfully fetched ${fetchedUsers.length} users`);
        
        // Sort users for better UI experience
        const sortedUsers = [...fetchedUsers].sort((a, b) => {
          const nameA = a.full_name || a.email || '';
          const nameB = b.full_name || b.email || '';
          return nameA.localeCompare(nameB);
        });
        
        setUsers(sortedUsers);
        setLastFetchTime(now);
      } else {
        console.warn('Invalid user array returned:', fetchedUsers);
        setUsers([]);
        setError('Received invalid user data from server');
      }
    } catch (error: any) {
      console.error('Error loading users:', error);
      const errorMsg = error.message || 'Unknown error'; 
      
      // Set more user-friendly error messages
      if (errorMsg.includes('Authentication')) {
        setError('Session expired. Please log out and log in again.');
      } else if (errorMsg.includes('Access denied')) {
        setError('You do not have admin privileges to view this page.');
      } else {
        setError(`Error loading users: ${errorMsg}`);
      }
      
      toast.error(`Error loading users: ${errorMsg}. Please try again later.`);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, users.length, lastFetchTime, user?.id]);

  // Check if any admin exists in the system
  const checkAdminExists = useCallback(async () => {
    try {
      setError(null);
      const exists = await userService.checkAdminExists();
      console.log('Admin exists:', exists);
      setAnyAdminExists(exists);
      return exists; // This returns boolean, which matches our interface
    } catch (error: any) {
      console.error('Error checking admin existence:', error);
      setError(`Error checking if admin exists: ${error.message}`);
      setAnyAdminExists(false);
      return false;
    }
  }, []);
  
  // Create a new user
  const createUser = useCallback(async (userData: UserFormData) => {
    try {
      await userService.createUser(userData);
      // Immediately fetch users to update the list
      await fetchUsers(true); // Force refresh
    } catch (error: any) {
      console.error('Error creating user:', error);
      throw error;
    }
  }, [fetchUsers]);

  // Update an existing user
  const updateUser = useCallback(async (userId: string, userData: UserFormData) => {
    try {
      await userService.updateUserProfile(userId, userData);
      // Re-fetch users to refresh the UI
      await fetchUsers(true); // Force refresh
    } catch (error: any) {
      console.error('Error updating user:', error);
      throw error;
    }
  }, [fetchUsers]);

  // Delete/revoke access for a user
  const deleteUser = useCallback(async (userId: string) => {
    if (!userId) {
      throw new Error('Invalid user ID');
    }
    
    try {
      await userService.revokeUserAccess(userId);
      await fetchUsers(true); // Force refresh
    } catch (error: any) {
      console.error('Error removing user role:', error);
      throw error;
    }
  }, [fetchUsers]);

  // Add admin role to a user
  const addAdminRole = useCallback(async (userId: string) => {
    if (!userId) {
      throw new Error('Invalid user ID');
    }
    
    try {
      await userService.addAdminRole(userId);
      setAnyAdminExists(true);
      toast.success('Admin role successfully assigned');
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      console.error('Error setting admin role:', error);
      throw error;
    }
  }, []);

  // Auto-refresh users when admin status changes or component mounts
  useEffect(() => {
    if (isAdmin && user?.id) {
      console.log('Admin status detected, fetching users');
      fetchUsers().catch(error => {
        console.error('Failed to fetch users in effect:', error);
      });
    } else {
      console.log('Not admin, skipping auto-fetch');
    }
  }, [isAdmin, fetchUsers, user?.id]);
  
  // Check admin exists on mount
  useEffect(() => {
    if (user?.id) {
      checkAdminExists().catch(error => {
        console.error('Failed to check admin existence on mount:', error);
      });
    }
  }, [checkAdminExists, user?.id]);

  const value = {
    users,
    isLoading,
    error,
    anyAdminExists,
    fetchUsers: () => fetchUsers(true), // Expose with force refresh
    createUser,
    updateUser,
    deleteUser,
    checkAdminExists, // The function returning Promise<boolean>
    addAdminRole,
  };

  return (
    <UserManagementContext.Provider value={value}>
      {children}
    </UserManagementContext.Provider>
  );
};

export const useUserManagement = () => useContext(UserManagementContext);
