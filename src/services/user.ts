
/**
 * User Service Root
 * 
 * Top-level re-export of user service functionality with explicit exports
 * to prevent circular dependencies and unintended data fetching.
 */
import { UserFormData } from '@/types/user-types';
import { supabase } from '@/integrations/supabase/client';
import { isPreviewMode, simulateApiCall } from '@/services/previewService';
import { toast } from 'sonner';

// Import function types only (no implementation)
import type { invalidateUserCache as InvalidateCacheType } from './user/userFetchService';

// Export auth-related functions - imported dynamically when needed
export const checkUserIsAdmin = async (userId: string): Promise<boolean> => {
  // Dynamic import to avoid circular dependencies
  const { checkUserIsAdmin: checkAdminImpl } = await import('./auth/authService');
  return checkAdminImpl(userId);
};

// DO NOT re-export wildcard imports that could trigger fetches
// export * from './user'; // <-- REMOVED to prevent unintended importing

/**
 * Safe, isolated invalidateUserCache function
 * This prevents import of the actual fetchUsers implementation
 */
export const invalidateUserCache = (): void => {
  // Import dynamically to prevent circular dependencies
  import('./user/userFetchService').then(module => {
    module.invalidateUserCache();
  }).catch(error => {
    console.error('Error invalidating user cache:', error);
  });
};

/**
 * Create a new user securely
 * Uses direct RPC function for preview mode and edge function for production
 */
export const createUser = async (userData: UserFormData): Promise<void> => {
  try {
    // Use preview mode if enabled
    if (isPreviewMode()) {
      console.log('Preview mode - simulating user creation:', userData);
      await simulateApiCall(800, 1200);
      return;
    }

    // Get current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Authentication token missing or expired. Please sign in again.');
    }
    
    // Use edge function instead of direct RPC
    try {
      console.log('Creating user via edge function:', userData.email);
      
      // Call the edge function to create a user
      const { error } = await supabase.functions.invoke('create-user', {
        body: {
          email: userData.email,
          password: userData.password,
          full_name: userData.full_name || '',
          role: userData.role || 'user'
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      
      if (error) throw error;
    } catch (apiError: any) {
      console.error('Edge function error:', apiError);
      throw new Error(apiError.message || 'Error creating user');
    }
  } catch (error: any) {
    console.error('Error creating user:', error);
    throw new Error(error.message || 'Unknown error creating user');
  }
};

/**
 * Update a user securely
 * Uses RPC functions for direct database access and better security
 */
export const updateUser = async (userId: string, userData: UserFormData): Promise<void> => {
  try {
    if (!userId) {
      throw new Error('No user ID provided');
    }
    
    if (isPreviewMode()) {
      console.log('Preview mode - simulating user update:', userId, userData);
      await simulateApiCall(600, 1000);
      return;
    }
    
    // Get current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Authentication token missing or expired. Please sign in again.');
    }
    
    // Update profile if needed
    if (userData.full_name !== undefined) {
      const { error } = await supabase.rpc('update_user_profile_admin', {
        _user_id: userId,
        _full_name: userData.full_name
      });
      
      if (error) {
        console.error('Error updating profile:', error);
        // Try direct update as fallback
        const { error: directError } = await supabase
          .from('profiles')
          .update({ full_name: userData.full_name })
          .eq('id', userId);
          
        if (directError) throw directError;
      }
    }
    
    // Update role if needed
    if (userData.role) {
      const { error } = await supabase.rpc('set_user_role_admin', {
        _target_user_id: userId,
        _new_role: userData.role
      });
      
      if (error) {
        console.error('Error setting role:', error);
        // Try direct update as fallback
        const { error: directError } = await supabase
          .from('user_roles')
          .update({ role: userData.role })
          .eq('user_id', userId);
          
        if (directError) throw directError;
      }
    }
  } catch (error: any) {
    console.error('Error updating user:', error);
    throw new Error(error.message || 'Unknown error updating user');
  }
};

/**
 * Delete user securely
 * Uses RPC function with fallback to direct DB access
 */
export const deleteUser = async (userId: string): Promise<void> => {
  try {
    if (!userId) {
      throw new Error('Invalid user ID');
    }
    
    if (isPreviewMode()) {
      console.log('Preview mode - simulating user deletion:', userId);
      await simulateApiCall(600, 1000);
      return;
    }
    
    // Get current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Authentication token missing or expired. Please sign in again.');
    }
    
    // First try using the RPC function
    const { error } = await supabase.rpc('revoke_user_role', {
      target_user_id: userId
    });
    
    // If RPC fails, try direct delete as fallback
    if (error) {
      console.error('Error with RPC revoke:', error);
      const { error: directError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
        
      if (directError) throw directError;
    }
  } catch (error: any) {
    console.error('Error revoking user access:', error);
    throw new Error(error.message || 'Unknown error revoking user access');
  }
};

/**
 * Check if any admin exists
 * Uses RPC function with enhanced error handling
 */
export const checkAdminExists = async (): Promise<boolean> => {
  try {
    // Use preview mode if enabled
    if (isPreviewMode()) {
      console.log('Preview mode - simulating admin check');
      await simulateApiCall(300, 600);
      return true;
    }
    
    try {
      // First try the RPC function
      const { data, error } = await supabase.rpc('any_admin_exists');
      
      if (error) {
        console.error('Error with any_admin_exists RPC:', error);
        throw error;
      }
      
      return !!data;
    } catch (rpcError) {
      console.error('RPC error, trying direct query:', rpcError);
      
      // Fall back to direct query
      const { count, error } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');
        
      if (error) throw error;
      
      return (count || 0) > 0;
    }
  } catch (error: any) {
    console.error('Error checking admin existence:', error);
    toast.error(`Error checking admin status: ${error.message}`);
    
    // Default to true as a safer approach - don't want to accidentally 
    // let people create admin accounts if the check fails
    return true;
  }
};

/**
 * Add admin role to user
 * Uses RPC function with enhanced error handling
 */
export const addAdminRole = async (userId: string): Promise<void> => {
  try {
    if (!userId) {
      throw new Error('Invalid user ID');
    }
    
    if (isPreviewMode()) {
      console.log('Preview mode - simulating add admin role:', userId);
      await simulateApiCall(600, 1000);
      return;
    }
    
    // Get current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Authentication token missing or expired. Please sign in again.');
    }
    
    // Try using RPC function first
    const { error } = await supabase.rpc('set_user_role_admin', {
      _target_user_id: userId,
      _new_role: 'admin'
    });
    
    // If RPC fails, try direct insert/update
    if (error) {
      console.error('Error with RPC set role:', error);
      
      // Check if role exists
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (existingRole) {
        // Update existing role
        const { error: updateError } = await supabase
          .from('user_roles')
          .update({ role: 'admin' })
          .eq('user_id', userId);
          
        if (updateError) throw updateError;
      } else {
        // Insert new role
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: 'admin' });
          
        if (insertError) throw insertError;
      }
    }
  } catch (error: any) {
    console.error('Error setting admin role:', error);
    throw new Error(error.message || 'Unknown error setting admin role');
  }
};

// Explicitly export functions users need to fetch users
// This requires an explicit import to avoid unwanted execution
export const lazyLoadFetchUsers = async (): Promise<typeof import('./user/userFetchService').fetchUsers> => {
  try {
    const module = await import('./user/userFetchService');
    return module.fetchUsers;
  } catch (error) {
    console.error('Error loading fetchUsers function:', error);
    throw new Error('Failed to load user fetching functionality');
  }
};
