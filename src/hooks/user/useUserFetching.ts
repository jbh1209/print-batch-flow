
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { UserWithRole } from '@/types/user-types';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUsers, invalidateUserCache } from '@/services/user/userFetchService';
import { isPreviewMode } from '@/services/previewService';

/**
 * Hook for fetching user data with security enhancements
 */
export function useUserFetching() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAdmin } = useAuth();

  // Fetch all users with enhanced security
  const fetchAllUsers = useCallback(async () => {
    // Skip fetch if not admin
    if (!isAdmin) {
      console.log('Not admin, skipping fetchUsers');
      setIsLoading(false);
      return [];
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const loadedUsers = await fetchUsers();
      
      // Sort users by name for better UX
      const sortedUsers = [...loadedUsers].sort((a, b) => {
        const nameA = a.full_name || a.email || '';
        const nameB = b.full_name || b.email || '';
        return nameA.localeCompare(nameB);
      });
      
      setUsers(sortedUsers);
      return sortedUsers;
    } catch (error: any) {
      console.error('Error loading users:', error);
      setError(`Error loading users: ${error.message}`);
      toast.error(`Error loading users: ${error.message}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  return {
    users,
    isLoading,
    error,
    fetchUsers: fetchAllUsers,
    setUsers // Exposing this to allow other hooks to update users array
  };
}
