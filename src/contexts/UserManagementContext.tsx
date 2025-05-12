import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
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
  const [fetchAttempts, setFetchAttempts] = useState(0);
  const { user, isAdmin, session } = useAuth();

  // Check if we're in Lovable preview mode
  const isLovablePreview = 
    typeof window !== 'undefined' && 
    (window.location.hostname.includes('gpteng.co') || window.location.hostname.includes('lovable.dev'));

  // Fetch all users (admin only)
  const fetchUsers = useCallback(async () => {
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
      setIsLoading(false);
      return;
    }

    // Check if we have a valid session with a token
    if (!session?.access_token) {
      setError("Authentication token missing. Please sign in again.");
      setIsLoading(false);
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
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (fetchError) {
        console.error("Function error:", fetchError);
        console.error("Error details:", JSON.stringify(fetchError));
        
        // If this is a connection issue and we haven't retried too many times, retry
        if (fetchAttempts < 2 && (
          fetchError.message?.includes('Failed to fetch') || 
          fetchError.message?.includes('NetworkError')
        )) {
          setFetchAttempts(prev => prev + 1);
          throw new Error('Network connection error. Retrying...');
        }
        
        throw fetchError;
      }
      
      // Reset fetch attempts on success
      setFetchAttempts(0);
      
      if (!data) {
        throw new Error("No data returned from edge function");
      }
      
      console.log("Users fetched successfully:", data.length);
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      setError(error.message || 'Failed to fetch users');
      
      if (fetchAttempts < 2) {
        // If we haven't tried too many times, delay and try again
        console.log(`Retry attempt ${fetchAttempts + 1}/3`);
        setTimeout(() => {
          setFetchAttempts(prev => prev + 1);
          fetchUsers();
        }, 2000); // 2 second delay between retries
      } else {
        // Give up after multiple retries
        setError(`Failed to load users after multiple attempts: ${error.message}`);
        toast.error("Could not load users. Please try refreshing the page.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, isAdmin, session, fetchAttempts, isLovablePreview]);

  // Create a new user
  const createUser = useCallback(async (userData: UserFormData): Promise<void> => {
    if (isLovablePreview) {
      console.log("Preview mode detected, simulating user creation");
      await new Promise(resolve => setTimeout(resolve, 1000));
      setUsers(prev => [
        ...prev,
        {
          id: `preview-user-${Date.now()}`,
          email: userData.email,
          full_name: userData.full_name || '',
          role: userData.role || 'user',
          created_at: new Date().toISOString(),
        }
      ]);
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
      
      // Manually add the new user to the state to avoid another API call
      const newUser: UserWithRole = {
        id: data.user.id,
        email: data.user.email,
        full_name: userData.full_name || null,
        role: userData.role || 'user',
        created_at: new Date().toISOString()
      };
      
      setUsers(prevUsers => [...prevUsers, newUser]);
    } catch (error: any) {
      console.error('Error creating user:', error);
      throw error;
    }
  }, [user, isAdmin, session, isLovablePreview]);

  // Update an existing user
  const updateUser = useCallback(async (userId: string, userData: UserFormData): Promise<void> => {
    if (isLovablePreview) {
      console.log("Preview mode detected, simulating user update");
      await new Promise(resolve => setTimeout(resolve, 1000));
      setUsers(prev =>
        prev.map(u =>
          u.id === userId
            ? { ...u, full_name: userData.full_name || u.full_name, role: userData.role || u.role }
            : u
        )
      );
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
        
        // Optimistically update the role in the local state
        setUsers(prevUsers =>
          prevUsers.map(u => (u.id === userId ? { ...u, role: userData.role || 'user' } : u))
        );
      }
      
      // Update user profile if full_name provided
      if (userData.full_name) {
        const { error: profileError } = await supabase.rpc('update_user_profile_admin', {
          _user_id: userId,
          _full_name: userData.full_name
        });
          
        if (profileError) throw profileError;
        
        // Optimistically update the full_name in the local state
        setUsers(prevUsers =>
          prevUsers.map(u => (u.id === userId ? { ...u, full_name: userData.full_name } : u))
        );
      }
    } catch (error: any) {
      console.error('Error updating user:', error);
      throw error;
    }
  }, [user, isAdmin, session, isLovablePreview, users]);

  // Delete/deactivate a user
  const deleteUser = useCallback(async (userId: string): Promise<void> => {
    if (isLovablePreview) {
      console.log("Preview mode detected, simulating user deletion");
      await new Promise(resolve => setTimeout(resolve, 1000));
      setUsers(prev => prev.filter(u => u.id !== userId));
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
      
      // Optimistically update the user list by removing the deleted user
      setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
    } catch (error: any) {
      console.error('Error revoking user access:', error);
      throw error;
    }
  }, [user, isAdmin, session, isLovablePreview]);

  // Add admin role to a user
  const addAdminRole = useCallback(async (userId: string): Promise<void> => {
    if (isLovablePreview) {
      console.log("Preview mode detected, simulating add admin role");
      await new Promise(resolve => setTimeout(resolve, 1000));
      setUsers(prev =>
        prev.map(u => (u.id === userId ? { ...u, role: 'admin' } : u))
      );
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
      
      // Optimistically update the user role in the local state
      setUsers(prevUsers =>
        prevUsers.map(u => (u.id === userId ? { ...u, role: 'admin' } : u))
      );
    } catch (error: any) {
      console.error('Error setting admin role:', error);
      throw new Error(error.message || 'Failed to set admin role');
    }
  }, [user, isAdmin, session, isLovablePreview, fetchUsers]);

  // Load users on mount if user is admin and session exists, with debounce
  useEffect(() => {
    let isMounted = true;
    
    if (user && isAdmin && session?.access_token && isMounted) {
      fetchUsers();
    }
    
    return () => {
      isMounted = false;
    };
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
