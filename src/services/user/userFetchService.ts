
import { UserWithRole } from '@/types/user-types';
import { toast } from 'sonner';
import { isPreviewMode, simulateApiCall } from '@/services/previewService';
import { secureGetAllUsers } from '@/services/security/securityService';

/**
 * User fetching functions - Enhanced with security, retry logic, proper error handling, and connection robustness
 */

// In-memory cache implementation
const userCache = {
  data: null as UserWithRole[] | null,
  timestamp: 0,
  TTL: 30000, // 30 seconds cache lifetime
  
  isValid() {
    return this.data && (Date.now() - this.timestamp < this.TTL);
  },
  
  set(data: UserWithRole[]) {
    this.data = data;
    this.timestamp = Date.now();
  },
  
  clear() {
    this.data = null;
    this.timestamp = 0;
  }
};

// Fetch all users with their roles using secure implementation
export async function fetchUsers(retryCount = 0, maxRetries = 2): Promise<UserWithRole[]> {
  // Check cache first
  if (userCache.isValid()) {
    console.log('Using cached user data');
    return userCache.data as UserWithRole[];
  }
  
  try {
    console.log(`Fetching users (attempt ${retryCount + 1}/${maxRetries + 1})`);
    
    // For preview mode, simulate delay for realistic testing
    if (isPreviewMode()) {
      console.log('Preview mode detected, using mock data with simulated delay');
      await simulateApiCall(800, 1200);
      const mockUsers = await secureGetAllUsers(); // Gets mock data in preview mode
      userCache.set(mockUsers);
      return mockUsers;
    }
    
    // Use our secure implementation
    const users = await secureGetAllUsers();
    
    console.log(`Successfully fetched ${users.length} users`);
    
    // Cache the successful response
    userCache.set(users);
    
    return users;
  } catch (error: any) {
    console.error('Error in fetchUsers:', error);
    
    // Implement exponential backoff for retries
    if (retryCount < maxRetries) {
      const backoffTime = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s
      console.log(`Network error, retrying in ${backoffTime}ms...`);
      
      // Wait for backoff time
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      
      // Retry the request
      return fetchUsers(retryCount + 1, maxRetries);
    }
    
    // Only show toast on final retry failure
    if (retryCount >= maxRetries) {
      // Handle specific connection errors
      if (error.message?.includes('Failed to fetch') || 
          error.message?.includes('NetworkError') || 
          error.message?.includes('AbortError')) {
        toast.error('Connection error: Please check your network and try again');
        throw new Error('Connection error: Unable to communicate with the server.');
      }
      
      // Check if the error is about authorization
      if (error.message?.includes('Authentication') || 
          error.message?.includes('expired') || 
          error.message?.includes('session')) {
        throw new Error('Your session has expired. Please sign out and sign in again.');
      }
    }
    
    throw error;
  }
}

// Invalidate the user cache - call this after any data-changing operation
export function invalidateUserCache() {
  userCache.clear();
}
