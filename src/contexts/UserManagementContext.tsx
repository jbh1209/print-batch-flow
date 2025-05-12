
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
    // Check if we're in Lovable preview mode
    const isLovablePreview = 
      typeof window !== 'undefined' && 
      (window.location.hostname.includes('gpteng.co') || window.location.hostname.includes('lovable.dev'));
      
    if (isLovablePreview) {
      console.log("Preview mode detected, using mock user data");
      setUsers([
        {
          id: "preview-user-1",
          email: "admin@example.com",
          full_name: "Preview Admin",
          role: "admin",
          created_at: new Date().toISOString(),
        },
        {
          id: "preview-user-2",
          email: "user@example.com",
          full_name: "Preview User",
          role: "user",
          created_at: new Date().toISOString(),
        }
      ]);
      setIsLoading(false);
      setError(null);
      return;
    }

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
    // Check if we're in Lovable preview mode
    const isLovablePreview = 
      typeof window !== 'undefined' && 
      (window.location.hostname.includes('gpteng.co') || window.location.hostname.includes('lovable.dev'));
      
    if (isLovablePreview) {
      console.log("Preview mode detected, simulating user creation");
      // Simulate success
      await new Promise(resolve => setTimeout(resolve, 1000));
      return;
    }

    if (!user || !isAdmin || !session?.access_token) {
      throw new Error("Admin privileges required or session expired");
    }

    try {
      console.log("Creating user with data:", userData);
      const { data, error: createError } = await supabase.functions.invoke('create-user', {
        body: userData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (createError) {
        console.error("User creation error:", createError);
        throw new Error(`Failed to create user: ${createError.message || 'Unknown error'}`);
      }
      
      if (!data || !data.success) {
        console.error("Invalid response from create-user function:", data);
        throw new Error('User creation failed: Invalid response from server');
      }
      
      // Refresh the user list
      await fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      throw error;
    }
  };

  // Update an existing user
  const updateUser = async (userId: string, userData: UserFormData): Promise<void> => {
    // Check if we're in Lovable preview mode
    const isLovablePreview = 
      typeof window !== 'undefined' && 
      (window.location.hostname.includes('gpteng.co') || window.location.hostname.includes('lovable.dev'));
      
    if (isLovablePreview) {
      console.log("Preview mode detected, simulating user update");
      // Simulate success
      await new Promise(resolve => setTimeout(resolve, 1000));
      return;
    }

    if (!user || !isAdmin || !session?.access_token) {
      throw new Error("Admin privileges required or session expired");
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
        const { error: profileError } = await supabase.rpc('update_user_profile_admin', {
          _user_id: userId,
          _full_name: userData.full_name
        });
          
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
    // Check if we're in Lovable preview mode
    const isLovablePreview = 
      typeof window !== 'undefined' && 
      (window.location.hostname.includes('gpteng.co') || window.location.hostname.includes('lovable.dev'));
      
    if (isLovablePreview) {
      console.log("Preview mode detected, simulating user deletion");
      // Simulate success
      await new Promise(resolve => setTimeout(resolve, 1000));
      return;
    }

    if (!user || !isAdmin || !session?.access_token) {
      throw new Error("Admin privileges required or session expired");
    }

    try {
      // We'll use revoke_user_role instead of actual deletion
      // This retains the user but removes their access capabilities
      const { error: revokeError } = await supabase.rpc('revoke_user_role', {
        target_user_id: userId
      });
      
      if (revokeError) throw revokeError;
      
      // Refresh the user list
      await fetchUsers();
    } catch (error: any) {
      console.error('Error revoking user access:', error);
      throw error;
    }
  };

  // Add admin role to a user
  const addAdminRole = async (userId: string): Promise<void> => {
    // Check if we're in Lovable preview mode
    const isLovablePreview = 
      typeof window !== 'undefined' && 
      (window.location.hostname.includes('gpteng.co') || window.location.hostname.includes('lovable.dev'));
      
    if (isLovablePreview) {
      console.log("Preview mode detected, simulating add admin role");
      // Simulate success
      await new Promise(resolve => setTimeout(resolve, 1000));
      return;
    }

    if (!session?.access_token) {
      throw new Error("Authentication session expired. Please sign in again.");
    }
    
    try {
      const { error } = await supabase.rpc('set_user_role_admin', {
        _target_user_id: userId,
        _new_role: 'admin'
      });
      
      if (error) throw error;
      
      toast.success('Admin role granted successfully');
      
      // Refresh the user list
      await fetchUsers();
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
