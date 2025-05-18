
import { useCallback } from 'react';
import { toast } from 'sonner';
import { Session } from '@supabase/supabase-js';
import { revokeUserAccess } from '@/services/user/userRoleService';

/**
 * Hook for user deletion operations
 */
export function useUserDeletion(
  session: Session | null,
  fetchUsers: () => Promise<void>
) {
  // Delete/revoke access for a user
  const deleteUser = useCallback(async (userId: string) => {
    try {
      if (!userId) {
        throw new Error('Invalid user ID');
      }
      
      if (!session?.access_token) {
        throw new Error('Authentication token missing or expired. Please sign in again.');
      }
      
      // Use the service function to revoke user access
      await revokeUserAccess(userId);
      
      toast.success('User access revoked successfully');
      fetchUsers();
    } catch (error: any) {
      console.error('Error revoking user access:', error);
      toast.error(`Failed to revoke user access: ${error.message}`);
      throw error;
    }
  }, [fetchUsers, session]);

  return { deleteUser };
}
