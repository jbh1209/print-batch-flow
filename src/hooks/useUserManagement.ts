
/**
 * User Management Hook
 * 
 * IMPORTANT: This hook uses lazy-loading for all user-related functionality
 * to prevent circular dependencies and unintended data fetching.
 */
import { useState, useCallback, useEffect } from 'react';
import { UserWithRole } from '@/types/user-types';
import { isPreviewMode } from '@/services/core/previewService';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

/**
 * Hook for managing users in the admin interface
 */
export const useUserManagement = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anyAdminExists, setAnyAdminExists] = useState(false);
  const { isAdmin } = useAuth();
  
  // Lazy-load user services to prevent circular dependencies
  const loadUserServices = useCallback(async () => {
    try {
      // Dynamically import user service functions
      const userModule = await import('@/services/user');
      const fetchModule = await import('@/services/user/userFetchService');
      const roleModule = await import('@/services/user/userRoleService');
      
      return {
        fetchUsers: fetchModule.fetchUsers,
        createUser: userModule.createUser,
        updateUser: userModule.updateUser,
        deleteUser: userModule.deleteUser,
        checkAdminExists: roleModule.checkAdminExists,
        addAdminRole: roleModule.addAdminRole,
      };
    } catch (error) {
      console.error('Error loading user services:', error);
      throw new Error('Failed to load user management functionality');
    }
  }, []);
  
  // Fetch users data - EXPLICIT CALL ONLY
  const fetchUsers = useCallback(async () => {
    // Skip fetch if not admin
    if (!isAdmin && !isPreviewMode()) {
      console.log('Not admin, skipping fetchUsers');
      return;
    }
    
    setIsLoading(true);
    setIsRefreshing(true);
    setError(null);
    
    try {
      // Load the fetchUsers function on demand
      const services = await loadUserServices();
      console.log("Explicitly fetching users on demand");
      
      const loadedUsers = await services.fetchUsers();
      
      // Sort users by name for better UX
      const sortedUsers = [...loadedUsers].sort((a, b) => {
        const nameA = a.full_name || a.email || '';
        const nameB = b.full_name || b.email || '';
        return nameA.localeCompare(nameB);
      });
      
      setUsers(sortedUsers);
    } catch (error: any) {
      console.error('Error loading users:', error);
      setError(`Error loading users: ${error.message || 'Unknown error'}`);
      toast.error(`Error loading users: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isAdmin, loadUserServices]);
  
  // Create a new user
  const createUser = useCallback(async (userData: any) => {
    try {
      // Load the createUser function on demand
      const services = await loadUserServices();
      await services.createUser(userData);
      
      // Fetch updated user list
      await fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      throw error;
    }
  }, [fetchUsers, loadUserServices]);
  
  // Update an existing user
  const updateUser = useCallback(async (userId: string, userData: any) => {
    try {
      // Load the updateUser function on demand
      const services = await loadUserServices();
      await services.updateUser(userId, userData);
      
      // Fetch updated user list
      await fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      throw error;
    }
  }, [fetchUsers, loadUserServices]);
  
  // Delete/revoke a user
  const deleteUser = useCallback(async (userId: string) => {
    try {
      // Load the deleteUser function on demand
      const services = await loadUserServices();
      await services.deleteUser(userId);
      
      // Fetch updated user list
      await fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }, [fetchUsers, loadUserServices]);

  // Check if any admin exists
  const checkAdminExists = useCallback(async () => {
    try {
      setIsLoading(true);
      const services = await loadUserServices();
      const exists = await services.checkAdminExists();
      setAnyAdminExists(exists);
      return exists;
    } catch (error: any) {
      console.error('Error checking admin exists:', error);
      setError(`Error checking admin status: ${error.message || 'Unknown error'}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loadUserServices]);

  // Add admin role to a user
  const addAdminRole = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);
      const services = await loadUserServices();
      await services.addAdminRole(userId);
      setAnyAdminExists(true);
      // Refresh the user list
      await fetchUsers();
    } catch (error: any) {
      console.error('Error adding admin role:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [fetchUsers, loadUserServices]);

  return {
    users,
    isLoading,
    isRefreshing,
    error,
    anyAdminExists,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    checkAdminExists,
    addAdminRole,
    setUsers,
  };
};
