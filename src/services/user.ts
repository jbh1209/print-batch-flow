
import { supabase } from '@/integrations/supabase/client';
import { UserWithRole } from '@/types/user-types';

/**
 * Service for user-related operations
 */
export const UserService = {
  /**
   * Fetches all users with their roles
   */
  getAllUsers: async (): Promise<UserWithRole[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('get-all-users');
      
      if (error) {
        console.error('Error fetching users:', error);
        throw new Error(error.message || 'Failed to fetch users');
      }
      
      return data || [];
    } catch (error) {
      console.error('Exception fetching users:', error);
      throw error;
    }
  },
  
  /**
   * Updates a user's information
   */
  updateUser: async (userId: string, userData: { full_name?: string; role?: string }): Promise<void> => {
    try {
      // Update user role if provided
      if (userData.role) {
        const { error: roleError } = await supabase.rpc(
          userData.role === 'admin' ? 'add_admin_role' : 'remove_admin_role',
          { admin_user_id: userId }
        );
        
        if (roleError) {
          throw new Error(roleError.message);
        }
      }
      
      // Update profile if full_name provided
      if (userData.full_name !== undefined) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ full_name: userData.full_name })
          .eq('id', userId);
          
        if (profileError) {
          throw new Error(profileError.message);
        }
      }
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },
  
  /**
   * Creates a new user
   */
  createUser: async (userData: { email: string; password: string; full_name?: string; role?: string }): Promise<void> => {
    try {
      // Create user with auth
      const { data, error } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          full_name: userData.full_name || ''
        }
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      // Set user as admin if role is admin
      if (userData.role === 'admin' && data.user) {
        const { error: roleError } = await supabase.rpc('add_admin_role', { 
          admin_user_id: data.user.id 
        });
        
        if (roleError) {
          throw new Error(roleError.message);
        }
      }
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },
  
  /**
   * Revokes a user's access
   */
  revokeAccess: async (userId: string): Promise<void> => {
    try {
      // Remove admin role first
      await supabase.rpc('remove_admin_role', { admin_user_id: userId });
      
      // Then delete the user
      const { error } = await supabase.auth.admin.deleteUser(userId);
      
      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Error revoking user access:', error);
      throw error;
    }
  }
};
