
import { supabase } from '@/integrations/supabase/client';
import { UserWithRole } from '@/types/user-types';
import { getFreshAuthToken, handleAuthError } from '../auth/authService';

/**
 * User fetching functions - Enhanced with retry logic and proper error handling
 */

// Fetch all users with their roles
export async function fetchUsers(retryCount = 0, maxRetries = 3): Promise<UserWithRole[]> {
  try {
    console.log(`Fetching users using Edge Function (attempt ${retryCount + 1}/${maxRetries + 1})`);
    
    // Get a fresh token before making the request
    const token = await getFreshAuthToken();
    
    if (!token) {
      console.error('No auth token available');
      throw new Error('Authentication required: You must be logged in to access user data.');
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
      throw new Error('Invalid server response: Expected a list of users. Please try refreshing the page.');
    }
    
    console.log(`Successfully fetched ${data.length} users`);
    return data as UserWithRole[];
  } catch (error: any) {
    console.error('Error in fetchUsers:', error);
    
    // Check if the error is about the JWT
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
