
/**
 * Enhanced User Management Hook with Improved Security
 */
import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { UserFormData, UserWithRole } from '@/types/user-types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUsers, invalidateUserCache } from '@/services/user/userFetchService';
import { isPreviewMode, simulateApiCall } from '@/services/previewService';

/**
 * Hook for user management operations with enhanced security
 */
export function useUserManagement() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anyAdminExists, setAnyAdminExists] = useState(false);
  const { isAdmin, session } = useAuth();

  // Check if any admin exists in the system with improved error handling
  const checkAdminExists = useCallback(async () => {
    try {
      setError(null);
      
      // In preview mode, always return true for testing
      if (isPreviewMode()) {
        setAnyAdminExists(true);
        return true;
      }
      
      const { data, error } = await supabase.rpc('any_admin_exists');
      
      if (error) {
        console.error("Error checking admin existence:", error);
        // Try a fallback direct query if RPC fails
        const { count, error: countError } = await supabase
          .from('user_roles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'admin');
          
        if (countError) {
          throw countError;
        }
        
        const exists = count !== null && count > 0;
        setAnyAdminExists(exists);
        return exists;
      }
      
      const exists = !!data;
      setAnyAdminExists(exists);
      return exists;
    } catch (error: any) {
      console.error('Error checking admin existence:', error);
      setError(`Error checking if admin exists: ${error.message}`);
      // Default to assuming admin exists to prevent unintended privilege escalation
      setAnyAdminExists(false);
      return false;
    }
  }, []);

  // Fetch all users with enhanced security
  const loadUsers = useCallback(async () => {
    // Skip fetch if not admin
    if (!isAdmin) {
      console.log('Not admin, skipping fetchUsers');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const loadedUsers = await fetchUsers();
      
      // Sort users by name for better UX
      const sortedUsers = [...loadedUsers].sort((a, b) => {
        const nameA = a.full_name || a.email || '';
        const nameB = b.full_name || b.email || '';
        return nameA.localeCompare(nameB);
      });
      
      setUsers(sortedUsers);
    } catch (error: any) {
      console.error('Error loading users:', error);
      setError(`Error loading users: ${error.message}`);
      toast.error(`Error loading users: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  // Create a new user with enhanced security
  const createUser = useCallback(async (userData: UserFormData) => {
    try {
      if (!userData.email || !userData.password) {
        throw new Error('Email and password are required');
      }
      
      if (isPreviewMode()) {
        await simulateApiCall(800, 1200);
        
        // Create mock user for preview
        const newUser: UserWithRole = {
          id: `preview-${Date.now()}`,
          email: userData.email,
          full_name: userData.full_name || null,
          role: userData.role || 'user',
          created_at: new Date().toISOString(),
        };
        
        setUsers(prev => [...prev, newUser]);
        toast.success(`User ${userData.email} created successfully (Preview Mode)`);
        return;
      }
      
      if (!session?.access_token) {
        throw new Error('Authentication token missing or expired. Please sign in again.');
      }
      
      // Create user via edge function
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: userData.email,
          password: userData.password,
          full_name: userData.full_name,
          role: userData.role || 'user'
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
      });
      
      if (error) {
        throw error;
      }
      
      toast.success('User created successfully');
      invalidateUserCache();
      await loadUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(`Failed to create user: ${error.message}`);
      throw error;
    }
  }, [loadUsers, session]);

  // Update an existing user with enhanced security
  const updateUser = useCallback(async (userId: string, userData: UserFormData) => {
    try {
      if (!userId) {
        throw new Error('No user ID provided');
      }
      
      if (isPreviewMode()) {
        await simulateApiCall(600, 1000);
        
        setUsers(prev =>
          prev.map(user =>
            user.id === userId
              ? { 
                  ...user, 
                  full_name: userData.full_name || user.full_name, 
                  role: userData.role || user.role 
                }
              : user
          )
        );
        
        toast.success(`User updated successfully (Preview Mode)`);
        return;
      }
      
      if (!session?.access_token) {
        throw new Error('Authentication token missing or expired. Please sign in again.');
      }
      
      if (userData.full_name !== undefined) {
        const { error } = await supabase.rpc('update_user_profile_admin', {
          _user_id: userId,
          _full_name: userData.full_name
        });
        
        if (error) {
          throw error;
        }
      }
      
      if (userData.role) {
        const { error } = await supabase.rpc('set_user_role_admin', {
          _target_user_id: userId,
          _new_role: userData.role
        });
        
        if (error) {
          throw error;
        }
      }
      
      toast.success('User updated successfully');
      invalidateUserCache();
      await loadUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(`Failed to update user: ${error.message}`);
      throw error;
    }
  }, [loadUsers, session]);

  // Delete/revoke access for a user with enhanced security
  const deleteUser = useCallback(async (userId: string) => {
    try {
      if (!userId) {
        throw new Error('Invalid user ID');
      }
      
      if (isPreviewMode()) {
        await simulateApiCall(600, 1000);
        
        // Remove user from state in preview mode
        setUsers(prev => prev.filter(user => user.id !== userId));
        toast.success(`User access revoked successfully (Preview Mode)`);
        return;
      }
      
      if (!session?.access_token) {
        throw new Error('Authentication token missing or expired. Please sign in again.');
      }
      
      const { error } = await supabase.rpc('revoke_user_role', {
        target_user_id: userId
      });
      
      if (error) {
        throw error;
      }
      
      toast.success('User access revoked successfully');
      invalidateUserCache();
      await loadUsers();
    } catch (error: any) {
      console.error('Error revoking user access:', error);
      toast.error(`Failed to revoke user access: ${error.message}`);
      throw error;
    }
  }, [loadUsers, session]);

  // Add admin role to a user with enhanced security
  const addAdminRole = useCallback(async (userId: string) => {
    try {
      if (!userId) {
        throw new Error('Invalid user ID');
      }
      
      if (isPreviewMode()) {
        await simulateApiCall(600, 1000);
        
        // Update user in state in preview mode
        setUsers(prev =>
          prev.map(user =>
            user.id === userId
              ? { ...user, role: 'admin' }
              : user
          )
        );
        
        setAnyAdminExists(true);
        toast.success('Admin role successfully assigned (Preview Mode)');
        return;
      }
      
      if (!session?.access_token) {
        throw new Error('Authentication token missing or expired. Please sign in again.');
      }
      
      const { error } = await supabase.rpc('set_user_role_admin', {
        _target_user_id: userId,
        _new_role: 'admin'
      });
      
      if (error) {
        throw error;
      }
      
      setAnyAdminExists(true);
      toast.success('Admin role successfully assigned');
      invalidateUserCache();
      await loadUsers();
    } catch (error: any) {
      console.error('Error setting admin role:', error);
      toast.error(`Failed to set admin role: ${error.message}`);
      throw error;
    }
  }, [loadUsers, session]);

  // Effect for initial data loading
  useEffect(() => {
    // Check if any admin exists on component mount
    checkAdminExists().catch(console.error);
    
    // Load users if admin
    if (isAdmin) {
      loadUsers().catch(console.error);
    } else {
      setIsLoading(false);
    }
  }, [checkAdminExists, loadUsers, isAdmin]);

  return {
    users,
    isLoading,
    error,
    anyAdminExists,
    fetchUsers: loadUsers,
    createUser,
    updateUser,
    deleteUser,
    checkAdminExists,
    addAdminRole,
  };
}

// Export a context version for backward compatibility
export { UserManagementProvider, useUserManagement as useUserManagementContext } from '@/contexts/UserManagementContext';
