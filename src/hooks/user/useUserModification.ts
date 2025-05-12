
import { useCallback } from 'react';
import { toast } from 'sonner';
import { UserFormData } from '@/types/user-types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invalidateUserCache } from '@/services/user/userFetchService';
import { isPreviewMode, simulateApiCall } from '@/services/previewService';

/**
 * Hook for updating and deleting users with enhanced security
 */
export function useUserModification(fetchUsers: () => Promise<void>) {
  const { session } = useAuth();

  // Update an existing user with enhanced security
  const updateUser = useCallback(async (userId: string, userData: UserFormData) => {
    try {
      if (!userId) {
        throw new Error('No user ID provided');
      }
      
      if (isPreviewMode()) {
        await simulateApiCall(600, 1000);
        
        toast.success(`User updated successfully (Preview Mode)`);
        return;
      }
      
      if (!session?.access_token) {
        throw new Error('Authentication token missing or expired. Please sign in again.');
      }
      
      if (userData.full_name !== undefined) {
        const { error } = await supabase.rpc('update_user_profile_admin', {
          _user_id: userId,
          _full_name: userData.full_name
        });
        
        if (error) {
          throw error;
        }
      }
      
      if (userData.role) {
        const { error } = await supabase.rpc('set_user_role_admin', {
          _target_user_id: userId,
          _new_role: userData.role
        });
        
        if (error) {
          throw error;
        }
      }
      
      toast.success('User updated successfully');
      invalidateUserCache();
      await fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(`Failed to update user: ${error.message}`);
      throw error;
    }
  }, [fetchUsers, session]);

  // Delete/revoke access for a user with enhanced security
  const deleteUser = useCallback(async (userId: string) => {
    try {
      if (!userId) {
        throw new Error('Invalid user ID');
      }
      
      if (isPreviewMode()) {
        await simulateApiCall(600, 1000);
        
        toast.success(`User access revoked successfully (Preview Mode)`);
        return;
      }
      
      if (!session?.access_token) {
        throw new Error('Authentication token missing or expired. Please sign in again.');
      }
      
      const { error } = await supabase.rpc('revoke_user_role', {
        target_user_id: userId
      });
      
      if (error) {
        throw error;
      }
      
      toast.success('User access revoked successfully');
      invalidateUserCache();
      await fetchUsers();
    } catch (error: any) {
      console.error('Error revoking user access:', error);
      toast.error(`Failed to revoke user access: ${error.message}`);
      throw error;
    }
  }, [fetchUsers, session]);

  return { updateUser, deleteUser };
}
