
import { supabase, adminClient } from '@/integrations/supabase/client';
import { UserWithRole } from '@/types/user-types';
import { toast } from 'sonner';

/**
 * User fetching functions - Enhanced with retry logic, proper error handling, and connection robustness
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

// Fetch all users with their roles
export async function fetchUsers(retryCount = 0, maxRetries = 2): Promise<UserWithRole[]> {
  // Check cache first
  if (userCache.isValid()) {
    console.log('Using cached user data');
    return userCache.data as UserWithRole[];
  }
  
  try {
    console.log(`Fetching users using Edge Function (attempt ${retryCount + 1}/${maxRetries + 1})`);
    
    // Get current session to ensure we have a fresh token
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !sessionData.session?.access_token) {
      console.error('Session error:', sessionError || 'No access token available');
      throw new Error('Authentication error: Your session has expired. Please log out and log back in.');
    }
    
    // Set timeout for the request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    try {
      // Call the edge function using HTTP-only client with explicit auth header
      console.log('Making HTTP request to edge function with valid token');
      const { data, error } = await adminClient.functions.invoke('get-all-users', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json',
          // Explicitly request JSON response
          'Accept': 'application/json',
          // Bypass cache for forced refreshes
          'Cache-Control': retryCount > 0 ? 'no-cache' : 'max-age=5'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (error) {
        console.error('Edge function error:', error);
        console.error('Error details:', JSON.stringify(error));
        
        // Handle network connection errors specifically
        if (error.message?.includes('Failed to fetch') || 
            error.message?.includes('NetworkError') ||
            error.message?.includes('AbortError')) {
          if (retryCount < maxRetries) {
            // Backend connection issue, retry with backoff
            const backoffTime = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s
            console.log(`Network error, retrying in ${backoffTime}ms...`);
            
            // Wait for backoff time
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            
            // Retry the request
            return fetchUsers(retryCount + 1, maxRetries);
          } else {
            throw new Error('Network connection error: Unable to reach the server after multiple attempts.');
          }
        }
        
        // Handle authentication errors specifically
        if (error.status === 401) {
          userCache.clear(); // Clear cache on auth errors
          throw new Error('Authentication error: Your session has expired. Please log out and log back in.');
        } else if (error.status === 403) {
          userCache.clear(); // Clear cache on permission errors
          throw new Error('Access denied: You need admin privileges to view user data.');
        }
        
        throw new Error(`Failed to fetch users: ${error.message || 'Unknown error. Please try again later.'}`);
      }
      
      if (!data || !Array.isArray(data)) {
        console.error('Invalid response from edge function:', data);
        throw new Error('Invalid server response: Expected a list of users. Please try refreshing the page.');
      }
      
      console.log(`Successfully fetched ${data.length} users`);
      
      // Cache the successful response
      userCache.set(data as UserWithRole[]);
      
      return data as UserWithRole[];
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error: any) {
    console.error('Error in fetchUsers:', error);
    
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
