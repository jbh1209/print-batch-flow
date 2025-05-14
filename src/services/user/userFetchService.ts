
import { supabase } from '@/integrations/supabase/client';
import { UserWithRole, validateUserRole, UserRole } from '@/types/user-types';
import { isPreviewMode, getMockUsers } from '@/services/previewService';

// Request controller for cancellation
let currentController: AbortController | null = null;

/**
 * Cancel any pending requests
 */
export const cancelFetchUsers = () => {
  if (currentController) {
    console.log('Cancelling user fetch request');
    currentController.abort();
    currentController = null;
  }
};

/**
 * Invalidate user cache
 * This is a no-op function to maintain API compatibility
 */
export const invalidateUserCache = () => {
  console.log('User cache invalidated - no caching is used anymore');
};

/**
 * Securely get all users with their roles
 * IMPORTANT: This function should ONLY be called on demand from the Users admin page
 * and nowhere else in the application.
 */
export const fetchUsers = async (): Promise<UserWithRole[]> => {
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
    return mockUsers;
  }

  try {
    console.log('Fetching users from database - ADMIN PAGE ONLY');
    
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
        // Important: Process each item separately to ensure proper typing
        const validatedUsers: UserWithRole[] = data.map(user => {
          // First validate the role
          const validRole = validateUserRole(user.role);
          // Then create a properly typed object
          return {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            avatar_url: user.avatar_url,
            role: validRole as UserRole,
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at
          };
        });
        
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
          // Create properly typed objects
          const validatedUsers: UserWithRole[] = data.map(user => {
            const validRole = validateUserRole(user.role);
            return {
              id: user.id,
              email: user.email,
              full_name: user.full_name,
              avatar_url: user.avatar_url,
              role: validRole as UserRole,
              created_at: user.created_at,
              last_sign_in_at: user.last_sign_in_at
            };
          });
          
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
        
        // Combine data using profiles as the base and ensure proper typing
        const validatedUsers: UserWithRole[] = profiles.map(profile => {
          const userRole = roles?.find(r => r.user_id === profile.id);
          const validRole = validateUserRole(userRole?.role || 'user');
          
          return {
            id: profile.id,
            email: profile.id, // Limited: we don't have emails, so use id as placeholder
            full_name: profile.full_name || null,
            avatar_url: profile.avatar_url || null,
            role: validRole as UserRole,
            created_at: profile.created_at,
            last_sign_in_at: null
          };
        });
        
        return validatedUsers;
      }
    }
  } catch (error: any) {
    console.error('Error in fetchUsers:', error);
    // Only propagate non-abort errors
    if (error.message !== 'Request aborted') {
      throw error;
    }
    // Return empty array when request is aborted
    return [];
  } finally {
    currentController = null;
  }
};
