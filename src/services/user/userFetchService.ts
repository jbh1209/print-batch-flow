
import { supabase } from '@/integrations/supabase/client';
import { UserWithRole } from '@/types/user-types';
import { toast } from 'sonner';

// Cache for users data to prevent excessive API calls
let usersCache: {
  data: UserWithRole[] | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0
};

// Cache expiration time (1 minute)
const CACHE_EXPIRATION = 60 * 1000;

// Flag to prevent concurrent API calls
let fetchInProgress = false;

/**
 * User fetching function with improved caching and error handling
 */
export async function fetchUsers(forceRefresh = false): Promise<UserWithRole[]> {
  try {
    // Check if we're already fetching users
    if (fetchInProgress) {
      console.log('Fetch already in progress, waiting...');
      // Wait and then use cache
      await new Promise(resolve => setTimeout(resolve, 100));
      return usersCache.data || [];
    }
    
    // Check if we have valid cached data
    const now = Date.now();
    if (!forceRefresh && usersCache.data && (now - usersCache.timestamp) < CACHE_EXPIRATION) {
      console.log('Using cached user data');
      return usersCache.data;
    }
    
    console.log(`Fetching users from edge function`);
    fetchInProgress = true;
    
    // Get current session and extract token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('No valid auth session:', sessionError?.message || 'Session is null');
      throw new Error('Authentication required: You must be logged in to access user data.');
    }
    
    const token = session.access_token;
    if (!token) {
      console.error('No auth token available');
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
      
      if (error.status === 401 || (error.message && error.message.includes('JWT'))) {
        throw new Error('Session expired. Please sign in again.');
      } else if (error.status === 403) {
        throw new Error('Access denied: You need admin privileges to view user data.');
      } 
      
      throw new Error(`Failed to fetch users: ${error.message || 'Unknown error'}`);
    }
    
    if (!data || !Array.isArray(data)) {
      throw new Error('Invalid server response: Expected a list of users.');
    }
    
    // Update cache
    usersCache = {
      data: data as UserWithRole[],
      timestamp: now
    };
    
    console.log(`Successfully fetched ${data.length} users`);
    return data as UserWithRole[];
  } catch (error: any) {
    console.error('Error in fetchUsers:', error);
    
    // For auth-related errors, clear the cache
    if (error.message?.includes('session') || 
        error.message?.includes('Authentication') || 
        error.message?.includes('expired')) {
      usersCache = { data: null, timestamp: 0 };
    }
    
    throw error;
  } finally {
    fetchInProgress = false;
  }
}
