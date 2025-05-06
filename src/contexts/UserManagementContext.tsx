
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
  const CACHE_DURATION = 20000; // Reduced to 20 seconds for more frequent updates during development

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
        if (fetchedUsers.length === 0) {
          // Show a warning if we got an empty array, might indicate a permission issue
          console.warn('User list is empty - this might indicate an issue');
          toast.warning('No users found. Please check user permissions.');
        }
        
        // Sort users by name for better UI experience
        const sortedUsers = [...fetchedUsers].sort((a, b) => {
          // Sort by name if available, otherwise email
          const nameA = a.full_name || a.email || '';
          const nameB = b.full_name || b.email || '';
          return nameA.localeCompare(nameB);
        });
        
        setUsers(sortedUsers);
        setLastFetchTime(now);
        
        // If current user isn't in the list, add them with admin role
        if (user && isAdmin && !sortedUsers.some(u => u.id === user.id)) {
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
      const errorMsg = error.message || 'Unknown error'; 
      setError(`Error loading users: ${errorMsg}`);
      toast.error(`Error loading users: ${errorMsg}. Please try again later.`);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, user, users.length, lastFetchTime]);

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
      toast.success('User created successfully');
      // Immediately fetch users to update the list
      await fetchUsers(true); // Force refresh after creation
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(`Error creating user: ${error.message || 'Unknown error'}`);
      throw error;
    }
  }, [fetchUsers]);

  const updateUser = useCallback(async (userId: string, userData: UserFormData) => {
    try {
      await userService.updateUserProfile(userId, userData);
      toast.success('User updated successfully');
      // Critical: Re-fetch users to refresh the UI with updated data
      await fetchUsers(true); // Force refresh after update
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(`Error updating user: ${error.message || 'Unknown error'}`);
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
      await fetchUsers(true); // Force refresh after deletion
    } catch (error: any) {
      console.error('Error removing user role:', error);
      toast.error(`Error removing user role: ${error.message || 'Unknown error'}`);
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
      toast.error(`Failed to set admin role: ${error.message || 'Unknown error'}`);
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
