
import { supabase } from '@/integrations/supabase/client';
import { UserWithRole, UserRole } from '@/types/user-types';

/**
 * User fetching functions - Simplified to use Edge Function
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
      throw new Error(`Failed to fetch users: ${error.message}`);
    }
    
    if (!data || !Array.isArray(data)) {
      console.error('Invalid response from edge function:', data);
      return [];
    }
    
    console.log(`Successfully fetched ${data.length} users`);
    return data as UserWithRole[];
  } catch (error) {
    console.error('Error in fetchUsers:', error);
    throw error;
  }
}
