
import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { UserWithRole } from '@/types/user-types';
import { useAuth } from '@/contexts/AuthContext';
import { 
  fetchUsers, 
  invalidateUserCache, 
  cancelFetchUsers 
} from '@/services/user/userFetchService';
import { isPreviewMode } from '@/services/previewService';

const MAX_RETRY_COUNT = 3;
const CIRCUIT_BREAK_DURATION = 30000; // 30 seconds

/**
 * Hook for fetching user data with enhanced security and circuit breaker
 */
export function useUserFetching() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAdmin } = useAuth();
  
  // Circuit breaker state
  const failureCount = useRef(0);
  const circuitBreakerTimer = useRef<number | null>(null);
  const isCircuitOpen = useRef(false);

  // Reset circuit breaker
  const resetCircuitBreaker = useCallback(() => {
    console.log('Resetting circuit breaker');
    failureCount.current = 0;
    isCircuitOpen.current = false;
    if (circuitBreakerTimer.current) {
      window.clearTimeout(circuitBreakerTimer.current);
      circuitBreakerTimer.current = null;
    }
  }, []);

  // Implement circuit breaker logic
  const checkCircuitBreaker = useCallback((): boolean => {
    if (isCircuitOpen.current) {
      console.log('Circuit breaker is open, skipping request');
      return true;
    }
    
    if (failureCount.current >= MAX_RETRY_COUNT) {
      console.log('Too many failures, opening circuit breaker');
      isCircuitOpen.current = true;
      // Auto-reset after timeout
      circuitBreakerTimer.current = window.setTimeout(() => {
        console.log('Circuit breaker timeout elapsed, resetting');
        resetCircuitBreaker();
      }, CIRCUIT_BREAK_DURATION);
      return true;
    }
    
    return false;
  }, [resetCircuitBreaker]);

  // Fetch all users with enhanced security
  const fetchAllUsers = useCallback(async (): Promise<UserWithRole[]> => {
    // Skip fetch if not admin
    if (!isAdmin && !isPreviewMode()) {
      console.log('Not admin, skipping fetchUsers');
      setIsLoading(false);
      return [];
    }
    
    // Check circuit breaker
    if (checkCircuitBreaker()) {
      setError('Too many failed requests. Trying again later.');
      setIsLoading(false);
      return users; // Return current users state
    }
    
    setIsLoading(true);
    
    try {
      const loadedUsers = await fetchUsers();
      
      // Sort users by name for better UX
      const sortedUsers = [...loadedUsers].sort((a, b) => {
        const nameA = a.full_name || a.email || '';
        const nameB = b.full_name || b.email || '';
        return nameA.localeCompare(nameB);
      });
      
      setUsers(sortedUsers);
      setError(null);
      resetCircuitBreaker(); // Reset on success
      return sortedUsers;
    } catch (error: any) {
      console.error('Error loading users:', error);
      failureCount.current += 1;
      setError(`Error loading users: ${error.message}`);
      
      // Only show toast on first failure
      if (failureCount.current === 1) {
        toast.error(`Error loading users: ${error.message}`);
      }
      
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, checkCircuitBreaker, resetCircuitBreaker, users]);

  // Add a void version of the fetch function for context compatibility
  const fetchUsersVoid = useCallback(async (): Promise<void> => {
    await fetchAllUsers();
  }, [fetchAllUsers]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Cancel any in-flight requests
      cancelFetchUsers();
      // Clear any timers
      if (circuitBreakerTimer.current) {
        window.clearTimeout(circuitBreakerTimer.current);
      }
    };
  }, []);

  return {
    users,
    isLoading,
    error,
    fetchUsers: fetchAllUsers,
    fetchUsersVoid,
    setUsers,
    invalidateCache: invalidateUserCache
  };
}
