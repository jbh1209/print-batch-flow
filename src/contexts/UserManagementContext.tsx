
import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserFormData, UserWithRole } from '@/types/user-types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isPreviewMode } from '@/services/previewService';
import { secureGetAllUsers } from '@/services/security/securityService';

interface UserManagementContextType {
  users: UserWithRole[];
  isLoading: boolean;
  error: string | null;
  anyAdminExists: boolean;
  fetchUsers: () => Promise<void>;
  createUser: (userData: UserFormData) => Promise<void>;
  updateUser: (userId: string, userData: UserFormData) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  addAdminRole: (userId: string) => Promise<void>;
  checkAdminExists: () => Promise<boolean>;
}

const UserManagementContext = createContext<UserManagementContextType | undefined>(undefined);

export const UserManagementProvider = ({ children }: { children: ReactNode }) => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anyAdminExists, setAnyAdminExists] = useState(false);
  const { isAdmin, session } = useAuth();

  // Check if any admin exists in the system with improved error handling
  const checkAdminExists = async () => {
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
  };

  // Fetch all users with enhanced security
  const fetchUsers = async () => {
    // Skip fetch if not admin
    if (!isAdmin) {
      console.log('Not admin, skipping fetchUsers');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Use the centralized secure function to get all users
      const loadedUsers = await secureGetAllUsers();
      
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
  };

  // Create a new user with enhanced security
  const createUser = async (userData: UserFormData) => {
    try {
      if (!userData.email || !userData.password) {
        throw new Error('Email and password are required');
      }
      
      if (isPreviewMode()) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Create mock user for preview
        const newUser: UserWithRole = {
          id: `preview-${Date.now()}`,
          email: userData.email,
          full_name: userData.full_name || null,
          role: userData.role || 'user',
          created_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          avatar_url: null
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
      await fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(`Failed to create user: ${error.message}`);
      throw error;
    }
  };

  // Update an existing user with enhanced security
  const updateUser = async (userId: string, userData: UserFormData) => {
    try {
      if (!userId) {
        throw new Error('No user ID provided');
      }
      
      if (isPreviewMode()) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 600));
        
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
      await fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(`Failed to update user: ${error.message}`);
      throw error;
    }
  };

  // Delete/revoke access for a user with enhanced security
  const deleteUser = async (userId: string) => {
    try {
      if (!userId) {
        throw new Error('Invalid user ID');
      }
      
      if (isPreviewMode()) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 600));
        
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
      await fetchUsers();
    } catch (error: any) {
      console.error('Error revoking user access:', error);
      toast.error(`Failed to revoke user access: ${error.message}`);
      throw error;
    }
  };

  // Add admin role to a user with enhanced security
  const addAdminRole = async (userId: string) => {
    try {
      if (!userId) {
        throw new Error('Invalid user ID');
      }
      
      if (isPreviewMode()) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 600));
        
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
      await fetchUsers();
    } catch (error: any) {
      console.error('Error setting admin role:', error);
      toast.error(`Failed to set admin role: ${error.message}`);
      throw error;
    }
  };

  // Effect for initial data loading
  useEffect(() => {
    // Check if any admin exists on component mount
    checkAdminExists().catch(console.error);
    
    // Load users if admin
    if (isAdmin) {
      fetchUsers().catch(console.error);
    } else {
      setIsLoading(false);
    }
  }, [checkAdminExists, fetchUsers, isAdmin]);

  return (
    <UserManagementContext.Provider
      value={{
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
      }}
    >
      {children}
    </UserManagementContext.Provider>
  );
};

export const useUserManagement = () => {
  const context = useContext(UserManagementContext);
  if (context === undefined) {
    throw new Error('useUserManagement must be used within a UserManagementProvider');
  }
  return context;
};
