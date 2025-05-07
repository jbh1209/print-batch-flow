
import { supabase } from '@/integrations/supabase/client';
import { UserWithRole } from '@/types/user-types';
import { handleAuthError } from '../auth/authService';

// Cache for users data to prevent excessive API calls
let usersCache: {
  data: UserWithRole[] | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0
};

// Cache expiration time (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

// Flag to prevent concurrent API calls
let fetchInProgress = false;

/**
 * User fetching functions - Enhanced with retry logic, caching and proper error handling
 */
export async function fetchUsers(retryCount = 0, maxRetries = 3): Promise<UserWithRole[]> {
  try {
    // Check if we're already fetching users
    if (fetchInProgress) {
      console.log('Fetch already in progress, using pending request');
      // Wait for the current fetch to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      return fetchUsers(retryCount, maxRetries);
    }
    
    // Check if we have valid cached data
    const now = Date.now();
    if (usersCache.data && (now - usersCache.timestamp) < CACHE_EXPIRATION) {
      console.log('Using cached user data');
      return usersCache.data;
    }
    
    console.log(`Fetching users using Edge Function (attempt ${retryCount + 1}/${maxRetries + 1})`);
    fetchInProgress = true;
    
    // Get current session and extract token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('No auth session available:', sessionError?.message || 'Session is null');
      fetchInProgress = false;
      throw new Error('Authentication required: You must be logged in to access user data.');
    }
    
    const token = session.access_token;
    if (!token) {
      console.error('No auth token available');
      fetchInProgress = false;
      throw new Error('Authentication required: Invalid session token.');
    }
    
    // Call the edge function to get all users
    const { data, error } = await supabase.functions.invoke('get-all-users', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    if (error) {
      console.error('Edge function error:', error);
      fetchInProgress = false;
      
      // Handle authentication errors specifically
      if (error.status === 401 || (error.message && error.message.includes('JWT'))) {
        throw new Error('Authentication error: Your session has expired. Please log out and log back in.');
      } else if (error.status === 403) {
        throw new Error('Access denied: You need admin privileges to view user data.');
      } 
      
      // If we haven't reached max retries, attempt retry with exponential backoff
      if (retryCount < maxRetries) {
        const backoffTime = Math.pow(2, retryCount) * 500; // Exponential backoff: 500ms, 1s, 2s
        console.log(`Retrying user fetch in ${backoffTime}ms...`);
        
        // Wait for backoff time
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        
        // Retry the request
        return fetchUsers(retryCount + 1, maxRetries);
      }
      
      throw new Error(`Failed to fetch users: ${error.message || 'Unknown error. Please try again later.'}`);
    }
    
    if (!data || !Array.isArray(data)) {
      console.error('Invalid response from edge function:', data);
      fetchInProgress = false;
      throw new Error('Invalid server response: Expected a list of users. Please try refreshing the page.');
    }
    
    // Update cache
    usersCache = {
      data: data as UserWithRole[],
      timestamp: now
    };
    
    console.log(`Successfully fetched ${data.length} users`);
    fetchInProgress = false;
    return data as UserWithRole[];
  } catch (error: any) {
    console.error('Error in fetchUsers:', error);
    fetchInProgress = false;
    
    // Check if the error is auth-related
    if (error.message?.includes('JWT') || 
        error.message?.includes('expired') || 
        error.message?.includes('Authentication') ||
        error.message?.includes('401') ||
        error.message?.includes('Unauthorized')) {
      
      await handleAuthError(error);
      throw new Error('Your session has expired. Please sign out and sign in again.');
    }
    
    throw error;
  }
}
