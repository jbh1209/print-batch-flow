
// Re-export user service functionality in a standardized way
import { checkUserIsAdmin } from './auth/authService';
import { UserFormData } from '@/types/user-types';
import { supabase } from '@/integrations/supabase/client';
import { isPreviewMode, simulateApiCall } from '@/services/previewService';
import { fetchUsers as fetchUsersService } from './user/userFetchService';
import { toast } from 'sonner';

// Export all functions from the user module
export * from './user';

// Export auth-related functions
export { checkUserIsAdmin };

// Consistent fetch users functionality
export const fetchUsers = fetchUsersService;

// Create a new user securely
export const createUser = async (userData: UserFormData): Promise<void> => {
  try {
    if (isPreviewMode()) {
      await simulateApiCall(800, 1200);
      return;
    }

    // Get current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Authentication token missing or expired. Please sign in again.');
    }
    
    // Call the edge function to create a user
    const { error } = await supabase.functions.invoke('create-user', {
      body: JSON.stringify({
        email: userData.email,
        password: userData.password,
        full_name: userData.full_name,
        role: userData.role || 'user'
      }),
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (error) throw error;
    
  } catch (error: any) {
    console.error('Error creating user:', error);
    throw new Error(error.message || 'Unknown error creating user');
  }
};

// Update a user securely
export const updateUser = async (userId: string, userData: UserFormData): Promise<void> => {
  try {
    if (!userId) {
      throw new Error('No user ID provided');
    }
    
    if (isPreviewMode()) {
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
      
      if (error) throw error;
    }
    
    // Update role if needed
    if (userData.role) {
      const { error } = await supabase.rpc('set_user_role_admin', {
        _target_user_id: userId,
        _new_role: userData.role
      });
      
      if (error) throw error;
    }
  } catch (error: any) {
    console.error('Error updating user:', error);
    throw new Error(error.message || 'Unknown error updating user');
  }
};

// Delete user securely
export const deleteUser = async (userId: string): Promise<void> => {
  try {
    if (!userId) {
      throw new Error('Invalid user ID');
    }
    
    if (isPreviewMode()) {
      await simulateApiCall(600, 1000);
      return;
    }
    
    // Get current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Authentication token missing or expired. Please sign in again.');
    }
    
    // Revoke user role
    const { error } = await supabase.rpc('revoke_user_role', {
      target_user_id: userId
    });
    
    if (error) throw error;
  } catch (error: any) {
    console.error('Error revoking user access:', error);
    throw new Error(error.message || 'Unknown error revoking user access');
  }
};

// Check if any admin exists
export const checkAdminExists = async (): Promise<boolean> => {
  try {
    if (isPreviewMode()) {
      await simulateApiCall(300, 600);
      return true;
    }
    
    const { data, error } = await supabase.rpc('any_admin_exists');
    
    if (error) throw error;
    
    return !!data;
  } catch (error: any) {
    console.error('Error checking admin existence:', error);
    toast.error(`Error checking admin status: ${error.message}`);
    return false;
  }
};

// Add admin role to user
export const addAdminRole = async (userId: string): Promise<void> => {
  try {
    if (!userId) {
      throw new Error('Invalid user ID');
    }
    
    if (isPreviewMode()) {
      await simulateApiCall(600, 1000);
      return;
    }
    
    // Get current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Authentication token missing or expired. Please sign in again.');
    }
    
    // Set user role to admin
    const { error } = await supabase.rpc('set_user_role_admin', {
      _target_user_id: userId,
      _new_role: 'admin'
    });
    
    if (error) throw error;
  } catch (error: any) {
    console.error('Error setting admin role:', error);
    throw new Error(error.message || 'Unknown error setting admin role');
  }
};
