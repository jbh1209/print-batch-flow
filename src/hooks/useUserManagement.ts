
import { useState, useCallback } from 'react';
import { UserFormData, UserWithRole } from '@/types/user-types';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { isPreviewMode } from '@/services/previewService';

// Improved user management hook that will ONLY be used on the Users page
export function useUserManagement() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anyAdminExists, setAnyAdminExists] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // On-demand fetch users - ONLY used on users page
  const fetchUsers = useCallback(async () => {
    // Skip fetch if not admin and not in preview mode
    if (!isAdmin && !isPreviewMode()) {
      console.log('Not admin, skipping fetchUsers in useUserManagement');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Fetching users in useUserManagement - EXPLICIT REQUEST");
      // Dynamically import to avoid loading this code unless explicitly called
      const { fetchUsers: fetchUsersService } = await import('@/services/user/userFetchService');
      const loadedUsers = await fetchUsersService();
      
      if (!loadedUsers || !Array.isArray(loadedUsers)) {
        throw new Error("Invalid user data structure received");
      }
      
      // Sort users by name for better UX
      const sortedUsers = [...loadedUsers].sort((a, b) => {
        const nameA = a.full_name || a.email || '';
        const nameB = b.full_name || b.email || '';
        return nameA.localeCompare(nameB);
      });
      
      setUsers(sortedUsers);
      console.log(`Successfully loaded ${sortedUsers.length} users`);
    } catch (error: any) {
      console.error('Error loading users:', error);
      setError(`Failed to load users: ${error.message || 'Unknown error'}`);
      toast.error(`Error loading users: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  // Check if any admin exists - this is a lightweight operation 
  const checkAdminExists = useCallback(async () => {
    try {
      setError(null);
      const { checkAdminExists } = await import('@/services/user');
      const adminExists = await checkAdminExists();
      console.log(`Admin exists check result: ${adminExists}`);
      setAnyAdminExists(adminExists);
      return adminExists;
    } catch (error: any) {
      console.error('Error checking admin existence:', error);
      setError(`Failed to check admin status: ${error.message || 'Unknown error'}`);
      return false;
    }
  }, []);

  // Create a new user
  const createUser = useCallback(async (userData: UserFormData) => {
    if (!userData.password) {
      throw new Error('Password is required when creating a user');
    }
    
    try {
      setError(null);
      const { createUser } = await import('@/services/user');
      await createUser(userData);
      toast.success(`User ${userData.email} created successfully`);
      await fetchUsers(); // Refresh the list
    } catch (error: any) {
      console.error('Error creating user:', error);
      setError(`Failed to create user: ${error.message || 'Unknown error'}`);
      throw error;
    }
  }, [fetchUsers]);

  // Update an existing user
  const updateUser = useCallback(async (userId: string, userData: UserFormData) => {
    try {
      setError(null);
      const { updateUser } = await import('@/services/user');
      await updateUser(userId, userData);
      toast.success(`User updated successfully`);
      await fetchUsers(); // Refresh the list
    } catch (error: any) {
      console.error('Error updating user:', error);
      setError(`Failed to update user: ${error.message || 'Unknown error'}`);
      throw error;
    }
  }, [fetchUsers]);

  // Delete a user
  const deleteUser = useCallback(async (userId: string) => {
    try {
      setError(null);
      const { deleteUser } = await import('@/services/user');
      await deleteUser(userId);
      toast.success('User access revoked successfully');
      await fetchUsers(); // Refresh the list
    } catch (error: any) {
      console.error('Error deleting user:', error);
      setError(`Failed to revoke user access: ${error.message || 'Unknown error'}`);
      throw error;
    }
  }, [fetchUsers]);

  // Add admin role to a user
  const addAdminRole = useCallback(async (userId: string) => {
    try {
      setError(null);
      const { addAdminRole } = await import('@/services/user');
      await addAdminRole(userId);
      toast.success('Admin role added successfully');
      await fetchUsers(); // Refresh the list
      await checkAdminExists(); // Update admin existence
    } catch (error: any) {
      console.error('Error adding admin role:', error);
      setError(`Failed to add admin role: ${error.message || 'Unknown error'}`);
      throw error;
    }
  }, [fetchUsers, checkAdminExists]);

  return {
    users,
    isLoading,
    error,
    anyAdminExists,
    isRefreshing,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    checkAdminExists,
    addAdminRole,
  };
}

// This is what's causing the error - we need to remove or fix this export
// We're updating it to simply re-export our hook itself for backward compatibility
export { useUserManagement as useUserManagementContext };

