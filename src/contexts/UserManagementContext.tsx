import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';
import { supabase, adminClient } from '@/integrations/supabase/client';
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

    // Check if we have a valid session with a token
    if (!session?.access_token) {
      setError("Authentication token missing. Please sign in again.");
      toast.error("Authentication token missing. Please sign in again.");
      return;
    }

    setIsLoading(true);
    setError(null);
    console.log("Starting user fetch with session token available:", !!session?.access_token);
    
    try {
      // Use adminClient for edge function calls to ensure HTTP/REST is used
      const { data, error: fetchError } = await adminClient.functions.invoke('get-all-users', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (fetchError) {
        console.error("Function error:", fetchError);
        console.error("Error details:", JSON.stringify(fetchError));
        
        // Handle connection errors
        if (fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('NetworkError')) {
          throw new Error('Network connection error. Please check your internet connection and try again.');
        }
        
        // Handle specific error cases
        if (fetchError.message?.includes('JWT') || fetchError.status === 401) {
          throw new Error('Authentication error: Your session has expired. Please sign out and sign in again.');
        }
        
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
      
      // If this is an auth error, suggest a sign out/in
      if (error.message?.includes('Authentication') || 
          error.message?.includes('expired') || 
          error.message?.includes('token')) {
        toast.error("Authentication error. Please sign out and sign in again.");
      } else if (error.message?.includes('Network') || error.message?.includes('connect')) {
        toast.error("Network error. Please check your internet connection and try again.");
      } else {
        toast.error(error.message || "Failed to fetch users");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new user with admin privileges
  const createUser = async (userData: UserFormData): Promise<void> => {
    if (!user || !isAdmin || !session?.access_token) {
      throw new Error("Admin privileges required or session expired");
    }

    try {
      const { data, error: createError } = await supabase.functions.invoke('create-user', {
        body: userData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
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
    if (!user || !isAdmin || !session?.access_token) {
      throw new Error("Admin privileges required or session expired");
    }

    try {
      // Update the user role if specified
      if (userData.role) {
        const response = await supabase.rpc('set_user_role_admin', {
          _target_user_id: userId,
          _new_role: userData.role
        } as any) as any;
        
        if (response.error) throw response.error;
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
    if (!user || !isAdmin || !session?.access_token) {
      throw new Error("Admin privileges required or session expired");
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
    if (!session?.access_token) {
      throw new Error("Authentication session expired. Please sign in again.");
    }
    
    try {
      const response = await supabase.rpc('set_user_role_admin', {
        _target_user_id: userId,
        _new_role: 'admin'
      } as any) as any;
      
      if (response.error) throw response.error;
      
      toast.success('Admin role granted successfully');
    } catch (error: any) {
      console.error('Error setting admin role:', error);
      throw new Error(error.message || 'Failed to set admin role');
    }
  };

  // Load users on mount if user is admin and session exists
  useEffect(() => {
    if (user && isAdmin && session?.access_token) {
      fetchUsers();
    }
  }, [user, isAdmin, session?.access_token]);

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
