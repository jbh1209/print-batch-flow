
/**
 * User Fetching Core Utilities
 * 
 * Provides secure methods for fetching multiple user records
 * with enhanced error handling, preview mode support, and multi-layered fallbacks.
 */
import { supabase, adminClient } from '@/integrations/supabase/client';
import { UserWithRole, validateUserRole } from '@/types/user-types';
import { isPreviewMode } from '@/services/previewService';

// Simple in-memory cache for user data with expiration
let userCache: UserWithRole[] | null = null;
let lastCacheTime: number = 0;
const CACHE_EXPIRY_MS = 60000; // 1 minute

/**
 * Clear user data cache to force a fresh fetch
 */
export const invalidateUserCache = (): void => {
  userCache = null;
  lastCacheTime = 0;
  console.log('User cache invalidated');
};

/**
 * Get preview mock data for testing
 * @param role User role to mock
 * @returns Mock user data
 */
export const getPreviewMockData = (role: 'admin' | 'user') => {
  return {
    id: role === 'admin' ? "preview-admin-1" : "preview-user-1",
    email: role === 'admin' ? "admin@example.com" : "user@example.com",
    created_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    role: role,
    full_name: role === 'admin' ? "Preview Admin" : "Regular User",
    avatar_url: null
  };
};

/**
 * Securely fetch all users with proper validation and authorization checks
 * @returns Promise resolving to array of users with roles
 */
export const fetchUsers = async (): Promise<UserWithRole[]> => {
  // Return cached data if valid
  const now = Date.now();
  if (userCache && (now - lastCacheTime < CACHE_EXPIRY_MS)) {
    console.log('Returning cached users data');
    return userCache;
  }
  
  // In preview mode, return mock data
  if (isPreviewMode()) {
    console.log("Preview mode detected, returning mock users data");
    const mockUsers: UserWithRole[] = [
      getPreviewMockData('admin') as UserWithRole,
      getPreviewMockData('user') as UserWithRole,
      {
        id: "preview-user-2",
        email: "dev@example.com",
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        role: "user",
        full_name: "Developer User",
        avatar_url: null
      }
    ];
    
    // Update cache
    userCache = mockUsers;
    lastCacheTime = now;
    
    return mockUsers;
  }
  
  try {
    console.log("Attempting to fetch all users with secure method");
    
    // Get current session to ensure we have a fresh token
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("Session error in fetchUsers:", sessionError);
      throw new Error('Authentication error: Your session has expired. Please log out and log back in.');
    }
    
    if (!sessionData.session?.access_token) {
      console.error("No access token available in fetchUsers");
      throw new Error('Authentication error: No valid session found. Please log in again.');
    }
    
    // APPROACH 1: Use RPC function (most reliable method)
    try {
      console.log("Trying RPC method: get_all_users_with_roles");
      // Use type assertion to fix TypeScript error
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'get_all_users_with_roles' as any
      );
      
      if (rpcError) {
        console.warn("RPC get_all_users_with_roles failed:", rpcError);
        throw rpcError; // Try next approach
      }
      
      if (!rpcData || !Array.isArray(rpcData)) {
        throw new Error("Invalid data format from RPC");
      }
      
      // Process and validate the data
      const typedUsers = rpcData.map((user: any) => ({
        id: user.id,
        email: user.email || '',
        full_name: user.full_name || null,
        role: validateUserRole(user.role),
        created_at: user.created_at || new Date().toISOString(),
        last_sign_in_at: user.last_sign_in_at || null,
        avatar_url: user.avatar_url || null
      }));
      
      // Update cache
      userCache = typedUsers;
      lastCacheTime = now;
      
      return typedUsers;
    } catch (rpcError) {
      console.warn("RPC approach failed, trying direct approach:", rpcError);
      
      // APPROACH 2: Secure edge function
      try {
        console.log('Trying edge function approach');
        const response = await fetch(`https://kgizusgqexmlfcqfjopk.supabase.co/functions/v1/get-all-users`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            // Add additional CORS headers
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
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
        
        // Ensure role values are valid
        const typedUsers = data.map((user: any) => ({
          ...user,
          role: validateUserRole(user.role)
        }));
        
        // Update cache
        userCache = typedUsers;
        lastCacheTime = now;
        
        return typedUsers;
      } catch (fetchError) {
        console.error("Direct fetch error:", fetchError);
        
        // APPROACH 3: Fallback to get_all_users_secure function
        console.log('Trying fallback to get_all_users_secure');
        const { data: authData, error: authError } = await supabase.rpc('get_all_users_secure');
        
        if (authError) {
          console.error("Error fetching auth data:", authError);
          throw authError;
        }
        
        if (!Array.isArray(authData)) {
          throw new Error("Invalid data format received from get_all_users_secure");
        }
        
        // Combine with role data
        // Get roles for those users
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role');
        
        if (rolesError) {
          console.error("Error fetching roles:", rolesError);
          // Continue without role data, defaulting to 'user'
        }
        
        // Create a map of user IDs to roles for easier lookup
        const roleMap = new Map();
        if (rolesData) {
          rolesData.forEach((roleEntry: any) => {
            roleMap.set(roleEntry.user_id, roleEntry.role);
          });
        }
        
        // Get profiles data
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url');
        
        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
          // Continue without profile data
        }
        
        // Create a map of user IDs to profile data
        const profileMap = new Map();
        if (profilesData) {
          profilesData.forEach((profile: any) => {
            profileMap.set(profile.id, profile);
          });
        }
        
        // Combine all the data
        const combinedUsers = authData.map((authUser: any) => {
          const profile = profileMap.get(authUser.id) || {};
          const role = validateUserRole(roleMap.get(authUser.id));
          
          return {
            id: authUser.id,
            email: authUser.email || 'email@unavailable.com',
            full_name: profile.full_name || null,
            role,
            created_at: new Date().toISOString(), // Fallback
            last_sign_in_at: null,
            avatar_url: profile.avatar_url || null
          } as UserWithRole;
        });
        
        // Update cache
        userCache = combinedUsers;
        lastCacheTime = now;
        
        return combinedUsers;
      }
    }
  } catch (error: any) {
    console.error('Critical error in fetchUsers:', error);
    
    // Return informative error that can be displayed to users
    throw new Error(`Failed to load users: ${error.message || "Unknown error"}`);
  }
};
