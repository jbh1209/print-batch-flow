
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { UserFormData, UserWithRole } from '@/types/user-types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook for user management operations
 */
export function useUserManagement() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anyAdminExists, setAnyAdminExists] = useState(false);
  const { isAdmin } = useAuth();

  // Check if any admin exists in the system
  const checkAdminExists = useCallback(async () => {
    try {
      setError(null);
      const { data, error } = await supabase.rpc('any_admin_exists');
      
      if (error) {
        throw error;
      }
      
      const exists = !!data;
      setAnyAdminExists(exists);
      return exists;
    } catch (error: any) {
      console.error('Error checking admin existence:', error);
      setError(`Error checking if admin exists: ${error.message}`);
      setAnyAdminExists(false);
      return false;
    }
  }, []);

  // Fetch all users
  const fetchUsers = useCallback(async () => {
    // Skip fetch if not admin
    if (!isAdmin) {
      console.log('Not admin, skipping fetchUsers');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Call the edge function to get users
      const { data, error } = await supabase.functions.invoke('get-all-users', {
        method: 'GET',
      });
      
      if (error) {
        throw error;
      }
      
      if (Array.isArray(data)) {
        const sortedUsers = [...data].sort((a, b) => {
          const nameA = a.full_name || a.email || '';
          const nameB = b.full_name || b.email || '';
          return nameA.localeCompare(nameB);
        });
        
        setUsers(sortedUsers);
      } else {
        setUsers([]);
        setError('Invalid user data received from server');
      }
    } catch (error: any) {
      console.error('Error loading users:', error);
      setError(`Error loading users: ${error.message}`);
      toast.error(`Error loading users: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  // Create a new user
  const createUser = useCallback(async (userData: UserFormData) => {
    try {
      if (!userData.email || !userData.password) {
        throw new Error('Email and password are required');
      }
      
      // Create user via edge function
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: userData.email,
          password: userData.password,
          full_name: userData.full_name,
          role: userData.role || 'user'
        }
      });
      
      if (error) {
        throw error;
      }
      
      toast.success('User created successfully');
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(`Failed to create user: ${error.message}`);
      throw error;
    }
  }, [fetchUsers]);

  // Update an existing user
  const updateUser = useCallback(async (userId: string, userData: UserFormData) => {
    try {
      if (!userId) {
        throw new Error('No user ID provided');
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
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(`Failed to update user: ${error.message}`);
      throw error;
    }
  }, [fetchUsers]);

  // Delete/revoke access for a user
  const deleteUser = useCallback(async (userId: string) => {
    try {
      if (!userId) {
        throw new Error('Invalid user ID');
      }
      
      const { error } = await supabase.rpc('revoke_user_role', {
        target_user_id: userId
      });
      
      if (error) {
        throw error;
      }
      
      toast.success('User access revoked successfully');
      fetchUsers();
    } catch (error: any) {
      console.error('Error revoking user access:', error);
      toast.error(`Failed to revoke user access: ${error.message}`);
      throw error;
    }
  }, [fetchUsers]);

  // Add admin role to a user
  const addAdminRole = useCallback(async (userId: string) => {
    try {
      if (!userId) {
        throw new Error('Invalid user ID');
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
      fetchUsers();
    } catch (error: any) {
      console.error('Error setting admin role:', error);
      toast.error(`Failed to set admin role: ${error.message}`);
      throw error;
    }
  }, [fetchUsers]);

  return {
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
}
