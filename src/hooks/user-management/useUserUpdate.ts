
import { useCallback } from 'react';
import { toast } from 'sonner';
import { UserFormData } from '@/types/user-types';
import { Session } from '@supabase/supabase-js';
import { updateUserProfile } from '@/services/user/userProfileService';
import { updateUserRole } from '@/services/user/userRoleService';

/**
 * Hook for user update operations
 */
export function useUserUpdate(
  session: Session | null,
  fetchUsers: () => Promise<void>
) {
  // Update an existing user
  const updateUser = useCallback(async (userId: string, userData: UserFormData) => {
    try {
      if (!userId) {
        throw new Error('No user ID provided');
      }
      
      if (!session?.access_token) {
        throw new Error('Authentication token missing or expired. Please sign in again.');
      }
      
      // Update user profile if full_name is provided
      if (userData.full_name !== undefined) {
        await updateUserProfile(userId, {
          full_name: userData.full_name,
          email: '',  // Not updating email
        });
      }
      
      // Update user role if provided
      if (userData.role) {
        await updateUserRole(userId, userData.role);
      }
      
      toast.success('User updated successfully');
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(`Failed to update user: ${error.message}`);
      throw error;
    }
  }, [fetchUsers, session]);

  return { updateUser };
}
