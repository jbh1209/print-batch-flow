
/**
 * User Fetch Service - Explicit On-Demand Only
 * 
 * IMPORTANT: This service will ONLY fetch user data when explicitly called
 * and does not trigger any requests during module initialization
 */

import { UserWithRole } from '@/types/user-types';
import { isInPreviewMode, getMockUserData } from './fetch/mockUserData';
import { 
  fetchUsersWithRpc,
  fetchUsersWithEdgeFunction,
  fetchUsersWithDirectQueries
} from './fetch/userDataService';
import {
  createFetchController,
  resetFetchController,
  cancelFetchUsers,
  invalidateUserCache
} from './fetch/userFetchController';

// Re-export controller functions
export { cancelFetchUsers, invalidateUserCache };

/**
 * Securely get all users with their roles
 * IMPORTANT: This function should ONLY be called on demand from the Users admin page
 * and nowhere else in the application.
 */
export const fetchUsers = async (): Promise<UserWithRole[]> => {
  // Use preview mode data if enabled
  if (isInPreviewMode()) {
    return getMockUserData();
  }

  // Create controller and get signal
  const signal = createFetchController();
  
  try {
    console.log('Fetching users from database - ADMIN PAGE ONLY');
    
    // First try to use the RPC function
    try {
      return await fetchUsersWithRpc(signal);
    } catch (rpcError) {
      console.error('RPC error, trying edge function:', rpcError);
      
      // Try using the edge function as a fallback
      try {
        return await fetchUsersWithEdgeFunction(signal);
      } catch (edgeFunctionError) {
        console.error('Edge function error, trying direct queries:', edgeFunctionError);
        
        // Final fallback - try manual joins with allowed public tables
        return await fetchUsersWithDirectQueries(signal);
      }
    }
  } catch (error: any) {
    console.error('Error in fetchUsers:', error);
    // Only propagate non-abort errors
    if (error.message !== 'Request aborted') {
      throw error;
    }
    // Return empty array when request is aborted
    return [];
  } finally {
    resetFetchController();
  }
};
