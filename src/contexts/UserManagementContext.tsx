
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserFormData, UserWithRole } from '@/types/user-types';

interface UserManagementContextType {
  users: UserWithRole[];
  isLoading: boolean;
  error: string | null;
  fetchUsers: () => Promise<void>;
  createUser: (userData: UserFormData) => Promise<void>;
  updateUser: (userId: string, userData: UserFormData) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  addAdminRole: (userId: string) => Promise<void>;
}

const UserManagementContext = createContext<UserManagementContextType>({
  users: [],
  isLoading: false,
  error: null,
  fetchUsers: async () => {},
  createUser: async () => {},
  updateUser: async () => {},
  deleteUser: async () => {},
  addAdminRole: async () => {},
});

export const UserManagementProvider = ({ children }: { children: ReactNode }) => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, isAdmin, session } = useAuth();

  // Fetch all users (admin only)
  const fetchUsers = async () => {
    if (!user || !isAdmin) {
      setError("Admin privileges required");
      return;
    }

    setIsLoading(true);
    setError(null);
    console.log("Starting user fetch with session:", !!session);
    
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('get-all-users', {
        method: 'GET',
      });
      
      if (fetchError) {
        console.error("Function error:", fetchError);
        throw fetchError;
      }
      
      if (!data) {
        throw new Error("No data returned from edge function");
      }
      
      console.log("Users fetched successfully:", data.length);
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      setError(error.message || 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new user with admin privileges
  const createUser = async (userData: UserFormData): Promise<void> => {
    if (!user || !isAdmin) {
      throw new Error("Admin privileges required");
    }

    try {
      const { data, error: createError } = await supabase.functions.invoke('create-user', {
        body: userData
      });
      
      if (createError) throw createError;
      if (!data || !data.success) throw new Error('User creation failed');
      
      // Refresh the user list
      await fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      throw error;
    }
  };

  // Update an existing user
  const updateUser = async (userId: string, userData: UserFormData): Promise<void> => {
    if (!user || !isAdmin) {
      throw new Error("Admin privileges required");
    }

    try {
      // Update the user role if specified
      if (userData.role) {
        const { error: roleError } = await supabase.rpc('set_user_role_admin', {
          _target_user_id: userId,
          _new_role: userData.role
        });
        
        if (roleError) throw roleError;
      }
      
      // Update user profile if full_name provided
      if (userData.full_name) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ full_name: userData.full_name })
          .eq('id', userId);
          
        if (profileError) throw profileError;
      }
      
      // Refresh the user list
      await fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      throw error;
    }
  };

  // Delete/deactivate a user
  const deleteUser = async (userId: string): Promise<void> => {
    if (!user || !isAdmin) {
      throw new Error("Admin privileges required");
    }

    try {
      // Admin users can delete other users through the admin API
      const { error: deleteError } = await supabase.auth.admin.deleteUser(
        userId
      );
      
      if (deleteError) throw deleteError;
      
      // Refresh the user list
      await fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      throw error;
    }
  };

  // Add admin role to a user
  const addAdminRole = async (userId: string): Promise<void> => {
    try {
      const { error } = await supabase.rpc('set_user_role_admin', {
        _target_user_id: userId,
        _new_role: 'admin'
      });
      
      if (error) throw error;
      
      toast.success('Admin role granted successfully');
    } catch (error: any) {
      console.error('Error setting admin role:', error);
      throw new Error(error.message || 'Failed to set admin role');
    }
  };

  // Load users on mount if user is admin
  useEffect(() => {
    if (user && isAdmin && session) {
      fetchUsers();
    }
  }, [user, isAdmin, session]);

  const value = {
    users,
    isLoading,
    error,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    addAdminRole
  };

  return (
    <UserManagementContext.Provider value={value}>
      {children}
    </UserManagementContext.Provider>
  );
};

// Custom hook to use the user management context
export const useUserManagement = () => {
  const context = useContext(UserManagementContext);
  
  if (context === undefined) {
    throw new Error('useUserManagement must be used within a UserManagementProvider');
  }
  
  return context;
};
