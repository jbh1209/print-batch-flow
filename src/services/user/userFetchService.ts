
import { supabase } from '@/integrations/supabase/client';
import { UserWithRole, UserRole } from '@/types/user-types';

/**
 * User fetching functions - Simplified to use Edge Function
 * with improved error handling and recovery mechanisms
 */

// Fetch all users with their roles
export async function fetchUsers(): Promise<UserWithRole[]> {
  try {
    console.log('Fetching users using Edge Function');
    
    // Call the edge function to get all users
    const { data, error } = await supabase.functions.invoke('get-all-users', {
      method: 'GET',
    });
    
    if (error) {
      console.error('Edge function error:', error);
      
      // Provide more specific error messages based on status codes
      if (error.status === 401) {
        throw new Error('Authentication error: Please log out and log back in.');
      } else if (error.status === 403) {
        throw new Error('Access denied: Admin privileges required for this operation.');
      } else {
        throw new Error(`Failed to fetch users: ${error.message || 'Unknown error'}`);
      }
    }
    
    if (!data || !Array.isArray(data)) {
      console.error('Invalid response from edge function:', data);
      throw new Error('Invalid server response: Expected a list of users.');
    }
    
    console.log(`Successfully fetched ${data.length} users`);
    return data as UserWithRole[];
  } catch (error) {
    console.error('Error in fetchUsers:', error);
    throw error;
  }
}
