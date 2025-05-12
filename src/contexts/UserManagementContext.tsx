
import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase, adminClient, isLovablePreview } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserFormData, UserWithRole } from '@/types/user-types';

// Define the Supabase URL using the environment variable or directly
const SUPABASE_URL = "https://kgizusgqexmlfcqfjopk.supabase.co";

// Mock data used in preview mode
const MOCK_USERS: UserWithRole[] = [
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
  },
  {
    id: "preview-user-3",
    email: "dev@example.com",
    full_name: "Developer User",
    role: "user",
    created_at: new Date().toISOString(),
  }
];

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
  
  // Enhanced preview mode detection
  const isPreviewMode = useCallback(() => {
    // Check multiple indicators to ensure we properly detect preview mode
    return (
      isLovablePreview || 
      typeof window !== "undefined" && (
        window.location.hostname.includes('lovable.dev') || 
        window.location.hostname.includes('gpteng.co')
      )
    );
  }, []);

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
      // ENHANCED PREVIEW MODE: Always use mock data in preview
      if (isPreviewMode()) {
        console.log("Preview mode detected, using mock user data");
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API call with a shorter delay
        setUsers(MOCK_USERS);
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
        // APPROACH 1: Direct fetch method with improved error handling and CORS settings
        console.log("Attempting direct fetch to edge function");
        const response = await fetch(`${SUPABASE_URL}/functions/v1/get-all-users`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          // Add timeout for the fetch request
          signal: AbortSignal.timeout(8000)
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data)) {
          throw new Error("Invalid response format from edge function");
        }
        
        console.log("Users fetched successfully via direct fetch:", data.length);
        setUsers(data || []);
        setLastFetchTime(Date.now());
        fetchAttemptsRef.current = 0;
        setError(null);
      } catch (fetchError) {
        console.error("Direct fetch error:", fetchError);
        
        // APPROACH 2: Fall back to Supabase functions API
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
          
          // APPROACH 3: Last resort fallback to use built-in admin APIs
          console.log("Attempting last-resort admin API fallback");
          
          try {
            // Try to at least get basic user info without the full edge function
            const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
            
            if (authError) throw authError;
            
            // Map the basic user data to our expected format
            const basicUsers = authUsers.users.map(authUser => ({
              id: authUser.id,
              email: authUser.email || "",
              full_name: authUser.user_metadata?.full_name || null,
              role: "user", // Default role as we can't determine actual role
              created_at: authUser.created_at
            }));
            
            console.log("Basic user data retrieved via fallback:", basicUsers.length);
            setUsers(basicUsers);
            setLastFetchTime(Date.now());
            fetchAttemptsRef.current = 0;
            // Show partial success message
            setError("Limited user data available. Some features may be restricted.");
            return;
          } catch (fallbackError) {
            console.error("All fallback attempts failed:", fallbackError);
            throw functionError; // Throw original error
          }
        }
        
        if (!data || !Array.isArray(data)) {
          throw new Error("Invalid data format received from functions API");
        }
        
        console.log("Users fetched successfully via functions API:", data.length);
        setUsers(data);
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
  }, [user, isAdmin, session, users.length, lastFetchTime, isPreviewMode]);

  // Exposed fetch function that uses the debounced implementation
  const fetchUsers = useCallback(async () => {
    setError(null);
    debouncedFetchUsers();
  }, [debouncedFetchUsers]);

  // Create a new user with enhanced preview mode handling
  const createUser = useCallback(async (userData: UserFormData): Promise<void> => {
    // Handle preview mode separately for consistent behavior
    if (isPreviewMode()) {
      console.log("Preview mode detected, simulating user creation");
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Create a new mock user with realistic data
      const newMockUser: UserWithRole = {
        id: `preview-user-${Date.now()}`,
        email: userData.email,
        full_name: userData.full_name || '',
        role: userData.role || 'user',
        created_at: new Date().toISOString(),
      };
      
      setUsers(prev => [...prev, newMockUser]);
      toast.success(`User ${userData.email} created successfully (Preview Mode)`);
      return;
    }

    if (!user || !isAdmin || !session?.access_token) {
      throw new Error("Admin privileges required or session expired");
    }

    try {
      console.log("Creating user with data:", userData);
      setIsLoading(true);
      
      // APPROACH 1: Try direct fetch with improved error handling
      try {
        console.log("Attempting direct fetch for user creation");
        const response = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(userData),
          // Add timeout for the fetch request
          signal: AbortSignal.timeout(10000)
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
        
        // APPROACH 2: Fall back to Supabase functions API
        console.log("Falling back to Supabase functions API for user creation");
        
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
      toast.error(`Failed to create user: ${error.message || "Unknown error"}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [user, isAdmin, session, isPreviewMode]);

  // Update an existing user
  const updateUser = useCallback(async (userId: string, userData: UserFormData): Promise<void> => {
    // Handle preview mode separately for consistent behavior
    if (isPreviewMode()) {
      console.log("Preview mode detected, simulating user update");
      await new Promise(resolve => setTimeout(resolve, 600));
      
      setUsers(prev =>
        prev.map(u =>
          u.id === userId
            ? { 
                ...u, 
                full_name: userData.full_name || u.full_name, 
                role: userData.role || u.role 
              }
            : u
        )
      );
      
      toast.success(`User updated successfully (Preview Mode)`);
      return;
    }

    if (!user || !isAdmin || !session?.access_token) {
      throw new Error("Admin privileges required or session expired");
    }

    try {
      setIsLoading(true);
      const updatePromises = [];
      
      // Update the user role if specified
      if (userData.role) {
        console.log(`Updating role for user ${userId} to ${userData.role}`);
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
      if (userData.full_name !== undefined) {
        console.log(`Updating name for user ${userId} to "${userData.full_name}"`);
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
      toast.error(`Failed to update user: ${error.message || "Unknown error"}`);
      // Force a refresh of the data if the update failed
      debouncedFetchUsers();
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [user, isAdmin, session, debouncedFetchUsers, isPreviewMode]);

  // Delete/deactivate a user
  const deleteUser = useCallback(async (userId: string): Promise<void> => {
    // Handle preview mode separately for consistent behavior
    if (isPreviewMode()) {
      console.log("Preview mode detected, simulating user deletion");
      await new Promise(resolve => setTimeout(resolve, 600));
      
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success("User access revoked successfully (Preview Mode)");
      return;
    }

    if (!user || !isAdmin || !session?.access_token) {
      throw new Error("Admin privileges required or session expired");
    }

    try {
      setIsLoading(true);
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
      toast.error(`Failed to revoke user access: ${error.message || "Unknown error"}`);
      // Force a refresh of the data if the deletion failed
      debouncedFetchUsers();
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [user, isAdmin, session, debouncedFetchUsers, isPreviewMode]);

  // Add admin role to a user
  const addAdminRole = useCallback(async (userId: string): Promise<void> => {
    // Handle preview mode separately for consistent behavior
    if (isPreviewMode()) {
      console.log("Preview mode detected, simulating add admin role");
      await new Promise(resolve => setTimeout(resolve, 600));
      
      setUsers(prev =>
        prev.map(u => (u.id === userId ? { ...u, role: 'admin' } : u))
      );
      
      toast.success('Admin role granted successfully (Preview Mode)');
      return;
    }

    if (!session?.access_token) {
      throw new Error("Authentication session expired. Please sign in again.");
    }
    
    try {
      setIsLoading(true);
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
      toast.error(`Failed to set admin role: ${error.message || "Unknown error"}`);
      // Force a refresh of the data if the update failed
      debouncedFetchUsers();
      throw new Error(error.message || 'Failed to set admin role');
    } finally {
      setIsLoading(false);
    }
  }, [session, debouncedFetchUsers, isPreviewMode]);

  // Load users on mount if user is admin and session exists, with debounce
  useEffect(() => {
    let isMounted = true;
    
    if ((user && isAdmin && session?.access_token) || isPreviewMode()) {
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
  }, [user, isAdmin, session?.access_token, fetchUsers, isPreviewMode]);

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
