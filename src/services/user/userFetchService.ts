
import { supabase } from '@/integrations/supabase/client';
import { UserWithRole, validateUserRole } from '@/types/user-types';
import { isPreviewMode, getMockUsers } from '@/services/previewService';

// Cache for users data
let userCache: UserWithRole[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 60000; // 1 minute

// Request controller for cancellation
let currentController: AbortController | null = null;

/**
 * Invalidate the user cache to force a fresh fetch
 */
export const invalidateUserCache = () => {
  userCache = null;
  lastFetchTime = 0;
};

/**
 * Securely get all users with their roles
 * Uses optimistic updates and caching for better performance
 */
export const fetchUsers = async (): Promise<UserWithRole[]> => {
  // Return cached data if available and recent
  const now = Date.now();
  if (userCache && (now - lastFetchTime < CACHE_TTL)) {
    console.log('Using cached user data', userCache.length, 'users');
    return userCache;
  }
  
  // Cancel any pending requests
  if (currentController) {
    console.log('Cancelling existing user fetch request');
    currentController.abort();
  }
  
  // Create new controller for this request
  currentController = new AbortController();
  const signal = currentController.signal;
  
  // Use preview mode data if enabled
  if (isPreviewMode()) {
    console.log('Preview mode - using mock user data');
    const mockUsers = getMockUsers();
    userCache = mockUsers;
    lastFetchTime = now;
    return mockUsers;
  }

  try {
    console.log('Fetching users from database...');
    
    // First try to use the RPC function
    try {
      // Check if the request was cancelled
      if (signal.aborted) {
        console.log('User fetch aborted');
        throw new Error('Request aborted');
      }
      
      const { data, error } = await supabase.rpc('get_all_users_with_roles');
      
      if (error) {
        console.error('Error with get_all_users_with_roles RPC:', error);
        throw error;
      }
      
      if (data && Array.isArray(data)) {
        // Ensure correct types by properly validating and casting the role field
        const validatedUsers: UserWithRole[] = data.map(user => ({
          ...user,
          role: validateUserRole(user.role)
        }));
        
        userCache = validatedUsers;
        lastFetchTime = now;
        return validatedUsers;
      }
      
      throw new Error('Invalid response data');
    } catch (rpcError) {
      console.error('RPC error, trying edge function:', rpcError);
      
      // Check if the request was cancelled
      if (signal.aborted) {
        console.log('User fetch aborted');
        throw new Error('Request aborted');
      }
      
      // Try using the edge function as a fallback
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;
        
        if (!session) {
          throw new Error('Authentication required');
        }
        
        const { data, error } = await supabase.functions.invoke('get-all-users', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
        
        if (error) throw error;
        
        if (data && Array.isArray(data)) {
          // Ensure correct types by properly validating and casting the role field
          const validatedUsers: UserWithRole[] = data.map(user => ({
            ...user,
            role: validateUserRole(user.role)
          }));
          
          userCache = validatedUsers;
          lastFetchTime = now;
          return validatedUsers;
        }
        
        throw new Error('Invalid response data from edge function');
      } catch (edgeFunctionError) {
        console.error('Edge function error, trying direct queries:', edgeFunctionError);
        
        // Check if the request was cancelled
        if (signal.aborted) {
          console.log('User fetch aborted');
          throw new Error('Request aborted');
        }
        
        // Final fallback - try manual joins with allowed public tables
        
        // Get profiles which are in the public schema
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*');
          
        if (profilesError) throw profilesError;
        
        // Fetch roles
        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select('*');
          
        if (rolesError) throw rolesError;
        
        if (!profiles) {
          return [];
        }
        
        // Combine data using profiles as the base
        const combinedUsers = profiles.map(profile => {
          const userRole = roles?.find(r => r.user_id === profile.id);
          
          return {
            id: profile.id,
            email: profile.id, // Limited: we don't have emails, so use id as placeholder
            full_name: profile.full_name || null,
            avatar_url: profile.avatar_url || null,
            role: validateUserRole(userRole?.role || 'user'),
            created_at: profile.created_at,
            last_sign_in_at: null
          } as UserWithRole; // Explicit cast to UserWithRole after validation
        });
        
        userCache = combinedUsers;
        lastFetchTime = now;
        return combinedUsers;
      }
    }
  } catch (error: any) {
    console.error('Error in fetchUsers:', error);
    // Only propagate non-abort errors
    if (error.message !== 'Request aborted') {
      throw error;
    }
    // Return the cache if available when request is aborted
    return userCache || [];
  } finally {
    currentController = null;
  }
};

/**
 * Cleanup function to cancel any pending requests
 * Call this when component unmounts
 */
export const cancelFetchUsers = () => {
  if (currentController) {
    console.log('Cancelling user fetch on cleanup');
    currentController.abort();
    currentController = null;
  }
};
