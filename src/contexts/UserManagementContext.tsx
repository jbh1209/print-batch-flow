
import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase, adminClient, isLovablePreview } from '@/integrations/supabase/client';
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
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const { user, isAdmin, session } = useAuth();
  
  // Use refs to store state that won't trigger re-renders
  const fetchingRef = useRef<boolean>(false); // Active fetch in progress
  const pendingFetchRef = useRef<boolean>(false); // Pending fetch requests
  const retryTimeoutRef = useRef<number | null>(null); // For tracking retry timeouts
  const fetchAttemptsRef = useRef<number>(0); // Count fetch attempts
  const COOLDOWN_PERIOD = 5000; // 5 seconds between fetch attempts
  const CACHE_TTL = 30000; // 30 seconds cache lifetime

  // Debounced fetch function to prevent multiple concurrent calls
  const debouncedFetchUsers = useCallback(async () => {
    // If already fetching, mark as pending and return
    if (fetchingRef.current) {
      pendingFetchRef.current = true;
      return;
    }
    
    // Check for cooldown period
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime;
    if (timeSinceLastFetch < COOLDOWN_PERIOD) {
      console.log(`Fetch on cooldown. Will retry in ${COOLDOWN_PERIOD - timeSinceLastFetch}ms`);
      
      // Clear any existing timeout
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
      }
      
      // Set a new timeout after the cooldown period
      retryTimeoutRef.current = window.setTimeout(() => {
        retryTimeoutRef.current = null;
        debouncedFetchUsers();
      }, COOLDOWN_PERIOD - timeSinceLastFetch);
      
      return;
    }
    
    // If cache is still valid, no need to fetch
    if (users.length > 0 && timeSinceLastFetch < CACHE_TTL && fetchAttemptsRef.current === 0) {
      console.log('Using cached users data');
      return;
    }
    
    fetchingRef.current = true;
    setIsLoading(true);
    
    try {
      // Handle preview mode with mock data
      if (isLovablePreview) {
        console.log("Preview mode detected, using mock user data");
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
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
        setLastFetchTime(Date.now());
        fetchAttemptsRef.current = 0;
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
        return;
      }

      console.log("Starting user fetch with session token available:", !!session?.access_token);
      
      try {
        // Use raw fetch for edge function in production, bypassing WebSocket issues
        const response = await fetch(`${supabase.supabaseUrl}/functions/v1/get-all-users`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data)) {
          throw new Error("Invalid response format from edge function");
        }
        
        console.log("Users fetched successfully:", data.length);
        setUsers(data || []);
        setLastFetchTime(Date.now());
        fetchAttemptsRef.current = 0;
        setError(null);
      } catch (fetchError) {
        console.error("Direct fetch error:", fetchError);
        
        // Fall back to Supabase functions API if direct fetch fails
        console.log("Falling back to Supabase functions API");
        
        const { data, error: functionError } = await adminClient.functions.invoke('get-all-users', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (functionError) {
          console.error("Function error:", functionError);
          throw functionError;
        }
        
        if (!data) {
          throw new Error("No data returned from edge function");
        }
        
        console.log("Users fetched successfully via fallback:", data.length);
        setUsers(data || []);
        setLastFetchTime(Date.now());
        fetchAttemptsRef.current = 0;
        setError(null);
      }
    } catch (error: any) {
      console.error('Error fetching users:', error);
      setError(error.message || 'Failed to fetch users');
      
      // Increment fetch attempts counter
      fetchAttemptsRef.current += 1;
      
      // Limit the number of automatic retries
      if (fetchAttemptsRef.current <= 2) {
        const retryDelay = Math.min(2000 * Math.pow(2, fetchAttemptsRef.current - 1), 10000);
        console.log(`Scheduled retry attempt ${fetchAttemptsRef.current} in ${retryDelay}ms`);
        
        if (retryTimeoutRef.current) {
          window.clearTimeout(retryTimeoutRef.current);
        }
        
        // Schedule a single retry with increasing backoff
        retryTimeoutRef.current = window.setTimeout(() => {
          console.log(`Executing retry attempt ${fetchAttemptsRef.current}`);
          retryTimeoutRef.current = null;
          debouncedFetchUsers();
        }, retryDelay);
      } else {
        // Give up after multiple retries
        toast.error("Could not load users after multiple attempts. Please try refreshing the page.");
        fetchAttemptsRef.current = 0; // Reset for next manual attempt
      }
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
      
      // If there were pending requests while we were fetching,
      // schedule another fetch after a short delay
      if (pendingFetchRef.current) {
        pendingFetchRef.current = false;
        
        if (retryTimeoutRef.current) {
          window.clearTimeout(retryTimeoutRef.current);
        }
        
        retryTimeoutRef.current = window.setTimeout(() => {
          retryTimeoutRef.current = null;
          debouncedFetchUsers();
        }, 500); // Small delay to batch rapid requests
      }
    }
  }, [user, isAdmin, session, users.length, lastFetchTime]);

  // Exposed fetch function that uses the debounced implementation
  const fetchUsers = useCallback(async () => {
    setError(null);
    debouncedFetchUsers();
  }, [debouncedFetchUsers]);

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
      
      try {
        // Try direct fetch first
        const response = await fetch(`${supabase.supabaseUrl}/functions/v1/create-user`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(userData)
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data || !data.success) {
          throw new Error("Invalid response from create-user function");
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
        setLastFetchTime(Date.now()); // Update last fetch time to avoid immediate refetch
        toast.success("User created successfully");
      } catch (fetchError) {
        console.error("Direct fetch error:", fetchError);
        
        // Fall back to Supabase functions API
        const { data, error: createError } = await adminClient.functions.invoke('create-user', {
          method: 'POST',
          body: userData,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (createError) {
          console.error("User creation error:", createError);
          throw createError;
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
        setLastFetchTime(Date.now()); // Update last fetch time to avoid immediate refetch
        toast.success("User created successfully");
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      throw error;
    }
  }, [user, isAdmin, session]);

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
      const updatePromises = [];
      
      // Update the user role if specified
      if (userData.role) {
        const rolePromise = supabase.rpc('set_user_role_admin', {
          _target_user_id: userId,
          _new_role: userData.role
        }).then(({ error }) => {
          if (error) throw error;
        });
        
        updatePromises.push(rolePromise);
        
        // Optimistically update the role in the local state
        setUsers(prevUsers =>
          prevUsers.map(u => (u.id === userId ? { ...u, role: userData.role || 'user' } : u))
        );
      }
      
      // Update user profile if full_name provided
      if (userData.full_name) {
        const profilePromise = supabase.rpc('update_user_profile_admin', {
          _user_id: userId,
          _full_name: userData.full_name
        }).then(({ error }) => {
          if (error) throw error;
        });
        
        updatePromises.push(profilePromise);
        
        // Optimistically update the full_name in the local state
        setUsers(prevUsers =>
          prevUsers.map(u => (u.id === userId ? { ...u, full_name: userData.full_name } : u))
        );
      }
      
      // Wait for all updates to complete
      await Promise.all(updatePromises);
      setLastFetchTime(Date.now()); // Update last fetch time
      toast.success("User updated successfully");
    } catch (error: any) {
      console.error('Error updating user:', error);
      // Force a refresh of the data if the update failed
      debouncedFetchUsers();
      throw error;
    }
  }, [user, isAdmin, session, debouncedFetchUsers]);

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
      setLastFetchTime(Date.now()); // Update last fetch time
      toast.success("User access revoked successfully");
    } catch (error: any) {
      console.error('Error revoking user access:', error);
      // Force a refresh of the data if the deletion failed
      debouncedFetchUsers();
      throw error;
    }
  }, [user, isAdmin, session, debouncedFetchUsers]);

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
      setLastFetchTime(Date.now()); // Update last fetch time
    } catch (error: any) {
      console.error('Error setting admin role:', error);
      // Force a refresh of the data if the update failed
      debouncedFetchUsers();
      throw new Error(error.message || 'Failed to set admin role');
    }
  }, [session, debouncedFetchUsers]);

  // Load users on mount if user is admin and session exists, with debounce
  useEffect(() => {
    let isMounted = true;
    
    if (user && isAdmin && session?.access_token && isMounted) {
      fetchUsers();
    }
    
    return () => {
      isMounted = false;
      // Clean up any pending timeouts
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [user, isAdmin, session?.access_token, fetchUsers]);

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
