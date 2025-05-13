
import { useState, useEffect, useCallback } from 'react';
import { UserFormData, UserWithRole } from '@/types/user-types';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  fetchAllUsers, 
  createUser, 
  updateUser, 
  deleteUser, 
  checkAdminExists as checkIfAdminExists, 
  addAdminRole as giveUserAdminRole
} from '@/services/UserService';
import { isPreviewMode } from '@/services/PreviewService';

// Simplified user management hook
export function useUserManagement() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anyAdminExists, setAnyAdminExists] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAttempt, setLastRefreshAttempt] = useState(0);

  // Fetch users with better error handling
  const fetchUsers = useCallback(async () => {
    // Skip fetch if not admin
    if (!isAdmin && !isPreviewMode()) {
      console.log('Not admin, skipping fetchUsers');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const loadedUsers = await fetchAllUsers();
      setUsers(loadedUsers);
    } catch (error: any) {
      console.error('Error loading users:', error);
      setError(`Failed to load users: ${error.message || 'Unknown error'}`);
      toast.error(`Error loading users: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  // Check if any admin exists
  const checkAdminExists = useCallback(async () => {
    try {
      setError(null);
      const adminExists = await checkIfAdminExists();
      setAnyAdminExists(adminExists);
      return adminExists;
    } catch (error: any) {
      console.error('Error checking admin existence:', error);
      setError(`Failed to check admin status: ${error.message || 'Unknown error'}`);
      return false;
    }
  }, []);

  // Create a new user
  const handleCreateUser = useCallback(async (userData: UserFormData) => {
    try {
      setError(null);
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
  const handleUpdateUser = useCallback(async (userId: string, userData: UserFormData) => {
    try {
      setError(null);
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
  const handleDeleteUser = useCallback(async (userId: string) => {
    try {
      setError(null);
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
  const handleAddAdminRole = useCallback(async (userId: string) => {
    try {
      setError(null);
      await giveUserAdminRole(userId);
      toast.success('Admin role added successfully');
      await fetchUsers(); // Refresh the list
      await checkAdminExists(); // Update admin existence
    } catch (error: any) {
      console.error('Error adding admin role:', error);
      setError(`Failed to add admin role: ${error.message || 'Unknown error'}`);
      throw error;
    }
  }, [fetchUsers, checkAdminExists]);

  // Debounced refresh function
  const handleRefresh = useCallback(async () => {
    // Prevent rapid consecutive refreshes
    const now = Date.now();
    if (now - lastRefreshAttempt < 2000 || isRefreshing) {
      toast.error("Please wait before refreshing again");
      return;
    }
    
    try {
      setIsRefreshing(true);
      setLastRefreshAttempt(now);
      setError(null);
      toast.loading('Refreshing user data...', { duration: 3000 });
      await fetchUsers();
      await checkAdminExists();
    } catch (err: any) {
      setError(err.message || "Failed to refresh user data");
      toast.error(`Failed to refresh user data: ${err.message || "Unknown error"}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchUsers, checkAdminExists, isRefreshing, lastRefreshAttempt]);

  // Effect for initial data loading
  useEffect(() => {
    // Check if any admin exists on component mount
    checkAdminExists().catch(console.error);
    
    // Load users if admin
    if (isAdmin || isPreviewMode()) {
      fetchUsers().catch(console.error);
    }
  }, [checkAdminExists, fetchUsers, isAdmin]);

  return {
    users,
    isLoading,
    error,
    anyAdminExists,
    isRefreshing,
    fetchUsers: handleRefresh,
    createUser: handleCreateUser,
    updateUser: handleUpdateUser,
    deleteUser: handleDeleteUser,
    checkAdminExists,
    addAdminRole: handleAddAdminRole,
  };
}

// Export for backward compatibility
export { useUserManagement as useUserManagementContext } from '@/contexts/UserManagementContext';
