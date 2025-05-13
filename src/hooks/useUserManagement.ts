
import { useState, useEffect, useCallback } from 'react';
import { UserFormData, UserWithRole } from '@/types/user-types';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  fetchUsers, 
  createUser, 
  updateUser, 
  deleteUser, 
  checkAdminExists, 
  addAdminRole
} from '@/services/user';
import { isPreviewMode } from '@/services/previewService';

// Improved user management hook
export function useUserManagement() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anyAdminExists, setAnyAdminExists] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAttempt, setLastRefreshAttempt] = useState(0);

  // Fetch users with enhanced error handling
  const fetchAllUsers = useCallback(async () => {
    // Skip fetch if not admin
    if (!isAdmin && !isPreviewMode()) {
      console.log('Not admin, skipping fetchUsers');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Fetching users in useUserManagement");
      const loadedUsers = await fetchUsers();
      
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

  // Check if any admin exists
  const checkIfAdminExists = useCallback(async () => {
    try {
      setError(null);
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
  const handleCreateUser = useCallback(async (userData: UserFormData) => {
    if (!userData.password) {
      throw new Error('Password is required when creating a user');
    }
    
    try {
      setError(null);
      await createUser(userData);
      toast.success(`User ${userData.email} created successfully`);
      await fetchAllUsers(); // Refresh the list
    } catch (error: any) {
      console.error('Error creating user:', error);
      setError(`Failed to create user: ${error.message || 'Unknown error'}`);
      throw error;
    }
  }, [fetchAllUsers]);

  // Update an existing user
  const handleUpdateUser = useCallback(async (userId: string, userData: UserFormData) => {
    try {
      setError(null);
      await updateUser(userId, userData);
      toast.success(`User updated successfully`);
      await fetchAllUsers(); // Refresh the list
    } catch (error: any) {
      console.error('Error updating user:', error);
      setError(`Failed to update user: ${error.message || 'Unknown error'}`);
      throw error;
    }
  }, [fetchAllUsers]);

  // Delete a user
  const handleDeleteUser = useCallback(async (userId: string) => {
    try {
      setError(null);
      await deleteUser(userId);
      toast.success('User access revoked successfully');
      await fetchAllUsers(); // Refresh the list
    } catch (error: any) {
      console.error('Error deleting user:', error);
      setError(`Failed to revoke user access: ${error.message || 'Unknown error'}`);
      throw error;
    }
  }, [fetchAllUsers]);

  // Add admin role to a user
  const handleAddAdminRole = useCallback(async (userId: string) => {
    try {
      setError(null);
      await addAdminRole(userId);
      toast.success('Admin role added successfully');
      await fetchAllUsers(); // Refresh the list
      await checkIfAdminExists(); // Update admin existence
    } catch (error: any) {
      console.error('Error adding admin role:', error);
      setError(`Failed to add admin role: ${error.message || 'Unknown error'}`);
      throw error;
    }
  }, [fetchAllUsers, checkIfAdminExists]);

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
      console.log("Refreshing user data...");
      toast.loading('Refreshing user data...', { duration: 3000 });
      
      // First check admin status
      const adminExists = await checkIfAdminExists();
      console.log(`Admin exists: ${adminExists}`);
      
      // Then fetch users if we're an admin or in preview mode
      if (isAdmin || isPreviewMode()) {
        await fetchAllUsers();
      }
      
      toast.success("User data refreshed");
    } catch (err: any) {
      setError(err.message || "Failed to refresh user data");
      toast.error(`Failed to refresh user data: ${err.message || "Unknown error"}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchAllUsers, checkIfAdminExists, isRefreshing, lastRefreshAttempt, isAdmin]);

  // Effect for initial data loading
  useEffect(() => {
    // Check if any admin exists on component mount
    checkIfAdminExists().catch(err => {
      console.error("Error in initial admin check:", err);
    });
    
    // Load users if admin or in preview mode
    if (isAdmin || isPreviewMode()) {
      fetchAllUsers().catch(err => {
        console.error("Error in initial user fetch:", err);
      });
    } else {
      setIsLoading(false);
    }
  }, [checkIfAdminExists, fetchAllUsers, isAdmin]);

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
    checkAdminExists: checkIfAdminExists,
    addAdminRole: handleAddAdminRole,
  };
}

// Export for backward compatibility
export { useUserManagement as useUserManagementContext } from '@/contexts/UserManagementContext';
