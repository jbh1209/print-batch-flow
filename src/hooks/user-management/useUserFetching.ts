
import { useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { UserWithRole } from '@/types/user-types';
import { Session } from '@supabase/supabase-js';

/**
 * Hook for user fetching operations
 */
export function useUserFetching(
  isAdmin: boolean,
  session: Session | null,
  setUsers: (users: UserWithRole[]) => void,
  setIsLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
) {
  // Fetch all users
  const fetchUsers = useCallback(async () => {
    // Skip fetch if not admin
    if (!isAdmin) {
      console.log('Not admin, skipping fetchUsers');
      setIsLoading(false);
      return;
    }
    
    // Check if we have a valid access token
    if (!session?.access_token) {
      console.error('No access token available for API call');
      setError('Authentication token missing or expired. Please sign in again.');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Call the edge function to get users with explicit auth header
      const { data, error } = await supabase.functions.invoke('get-all-users', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
      });
      
      if (error) {
        console.error('Edge function error:', error);
        
        // Handle specific error types
        if (error.message?.includes('JWT') || error.status === 401) {
          throw new Error('Your session has expired. Please sign out and sign in again.');
        }
        
        throw error;
      }
      
      if (Array.isArray(data)) {
        const sortedUsers = [...data].sort((a, b) => {
          const nameA = a.full_name || a.email || '';
          const nameB = b.full_name || b.email || '';
          return nameA.localeCompare(nameB);
        });
        
        setUsers(sortedUsers);
      } else {
        setUsers([]);
        setError('Invalid user data received from server');
      }
    } catch (error: any) {
      console.error('Error loading users:', error);
      setError(`Error loading users: ${error.message}`);
      toast.error(`Error loading users: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, session, setUsers, setIsLoading, setError]);

  return { fetchUsers };
}
