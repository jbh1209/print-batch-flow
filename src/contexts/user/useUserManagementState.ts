
import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { UserFormData, UserWithRole } from '@/types/user-types';
import * as userService from '@/services/user';
import { useAuth } from '@/hooks/useAuth';
import { handleAuthError } from '@/services/auth/authService';

/**
 * Hook that manages the state and operations for user management
 */
export function useUserManagementState() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anyAdminExists, setAnyAdminExists] = useState(false);
  const { isAdmin, user } = useAuth();
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const CACHE_DURATION = 30000; // 30 seconds cache duration
  
  // Use refs to track mounting state and prevent unnecessary API calls
  const isMounted = useRef(true);
  const fetchInProgress = useRef(false);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Fetch users function with force refresh option
  const fetchUsers = useCallback(async (forceFetch = false) => {
    // Skip if already fetching or component unmounted
    if (fetchInProgress.current || !isMounted.current) {
      return;
    }
    
    // Skip fetch if not admin and not forced
    if (!isAdmin && !forceFetch) {
      console.log('Not admin and not forced fetch, skipping fetchUsers');
      setIsLoading(false);
      return;
    }
    
    // Check auth status before proceeding
    if (!user?.id) {
      console.log('No authenticated user, skipping fetchUsers');
      setError('Authentication required');
      setIsLoading(false);
      return;
    }
    
    // Use cache unless force refresh is requested
    const now = Date.now();
    if (!forceFetch && now - lastFetchTime < CACHE_DURATION && users.length > 0) {
      console.log(`Using cached user data from ${new Date(lastFetchTime).toLocaleTimeString()}`);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    fetchInProgress.current = true;
    
    try {
      console.log(`Fetching users at ${new Date().toLocaleTimeString()}`);
      const fetchedUsers = await userService.fetchUsers();
      
      // Guard against component unmount during fetch
      if (!isMounted.current) return;
      
      if (Array.isArray(fetchedUsers)) {
        console.log(`Successfully fetched ${fetchedUsers.length} users`);
        
        // Sort users for better UI experience
        const sortedUsers = [...fetchedUsers].sort((a, b) => {
          const nameA = a.full_name || a.email || '';
          const nameB = b.full_name || b.email || '';
          return nameA.localeCompare(nameB);
        });
        
        setUsers(sortedUsers);
        setLastFetchTime(now);
      } else {
        console.warn('Invalid user array returned:', fetchedUsers);
        setUsers([]);
        setError('Received invalid user data from server');
      }
    } catch (error: any) {
      if (!isMounted.current) return;
      
      console.error('Error loading users:', error);
      const errorMsg = error.message || 'Unknown error'; 
      
      // Check if it's an auth error that requires sign out
      if (errorMsg.includes('session') || 
          errorMsg.includes('Authentication') || 
          errorMsg.includes('expired')) {
        await handleAuthError(error);
      }
      
      // Set more user-friendly error messages
      if (errorMsg.includes('Authentication') || errorMsg.includes('session')) {
        setError('Your session has expired. Please sign out and sign in again.');
      } else if (errorMsg.includes('Access denied')) {
        setError('You do not have admin privileges to view this page.');
      } else {
        setError(`Error loading users: ${errorMsg}`);
      }
      
      toast.error(`Error loading users: ${errorMsg}. Please try again later.`);
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
      fetchInProgress.current = false;
    }
  }, [isAdmin, users.length, lastFetchTime, user?.id]);

  // Check if any admin exists in the system - with debouncing
  const adminCheckInProgress = useRef(false);
  
  const checkAdminExists = useCallback(async () => {
    if (adminCheckInProgress.current || !isMounted.current) return false;
    
    try {
      adminCheckInProgress.current = true;
      setError(null);
      const exists = await userService.checkAdminExists();
      
      if (isMounted.current) {
        console.log('Admin exists:', exists);
        setAnyAdminExists(exists);
      }
      
      return exists;
    } catch (error: any) {
      if (isMounted.current) {
        console.error('Error checking admin existence:', error);
        setError(`Error checking if admin exists: ${error.message}`);
        setAnyAdminExists(false);
      }
      return false;
    } finally {
      adminCheckInProgress.current = false;
    }
  }, []);
  
  // Create a new user
  const createUser = useCallback(async (userData: UserFormData) => {
    try {
      await userService.createUser(userData);
      // Immediately fetch users to update the list
      await fetchUsers(true); // Force refresh
    } catch (error: any) {
      console.error('Error creating user:', error);
      throw error;
    }
  }, [fetchUsers]);

  // Update an existing user
  const updateUser = useCallback(async (userId: string, userData: UserFormData) => {
    try {
      await userService.updateUserProfile(userId, userData);
      // Re-fetch users to refresh the UI
      await fetchUsers(true); // Force refresh
    } catch (error: any) {
      console.error('Error updating user:', error);
      throw error;
    }
  }, [fetchUsers]);

  // Delete/revoke access for a user
  const deleteUser = useCallback(async (userId: string) => {
    if (!userId) {
      throw new Error('Invalid user ID');
    }
    
    try {
      await userService.revokeUserAccess(userId);
      await fetchUsers(true); // Force refresh
    } catch (error: any) {
      console.error('Error removing user role:', error);
      throw error;
    }
  }, [fetchUsers]);

  // Add admin role to a user
  const addAdminRole = useCallback(async (userId: string) => {
    if (!userId) {
      throw new Error('Invalid user ID');
    }
    
    try {
      await userService.addAdminRole(userId);
      setAnyAdminExists(true);
      toast.success('Admin role successfully assigned');
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      console.error('Error setting admin role:', error);
      throw error;
    }
  }, []);

  // Auto-refresh users when admin status changes or component mounts - with clean dependency array
  useEffect(() => {
    let mounted = true;
    
    const initializeUsers = async () => {
      if (isAdmin && user?.id && mounted) {
        console.log('Admin status detected, fetching users');
        try {
          await fetchUsers();
        } catch (error) {
          console.error('Failed to fetch users in effect:', error);
        }
      } else {
        console.log('Not admin, skipping auto-fetch');
      }
    };
    
    initializeUsers();
    
    return () => {
      mounted = false;
    };
  }, [isAdmin, user?.id]); // Removed fetchUsers from dependency array to prevent loops
  
  // Check admin exists on mount - only once
  useEffect(() => {
    let mounted = true;
    
    if (user?.id) {
      checkAdminExists().catch(error => {
        if (mounted) {
          console.error('Failed to check admin existence on mount:', error);
        }
      });
    }
    
    return () => {
      mounted = false;
    };
  }, [user?.id]); // Removed checkAdminExists from dependency array to prevent loops

  return {
    users,
    isLoading,
    error,
    anyAdminExists,
    fetchUsers: () => fetchUsers(true), // Expose with force refresh
    createUser,
    updateUser,
    deleteUser,
    checkAdminExists,
    addAdminRole,
  };
}
