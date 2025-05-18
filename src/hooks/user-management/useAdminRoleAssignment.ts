
import { useCallback } from 'react';
import { toast } from 'sonner';
import { Session } from '@supabase/supabase-js';
import { addAdminRole } from '@/services/user/userRoleService';

/**
 * Hook for admin role operations
 */
export function useAdminRoleAssignment(
  session: Session | null,
  setAnyAdminExists: (exists: boolean) => void,
  fetchUsers: () => Promise<void>
) {
  // Add admin role to a user
  const addAdminRoleToUser = useCallback(async (userId: string) => {
    try {
      if (!userId) {
        throw new Error('Invalid user ID');
      }
      
      if (!session?.access_token) {
        throw new Error('Authentication token missing or expired. Please sign in again.');
      }
      
      // Use the service function to add admin role
      await addAdminRole(userId);
      
      setAnyAdminExists(true);
      toast.success('Admin role successfully assigned');
      fetchUsers();
    } catch (error: any) {
      console.error('Error setting admin role:', error);
      toast.error(`Failed to set admin role: ${error.message}`);
      throw error;
    }
  }, [fetchUsers, session, setAnyAdminExists]);

  return { addAdminRole: addAdminRoleToUser };
}
