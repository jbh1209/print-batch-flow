
import { supabase } from '@/integrations/supabase/client';

/**
 * Base utility functions for user services
 */

// Check if any admin exists in the system
export async function checkAdminExists(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('any_admin_exists');
    
    if (error) {
      console.error('Error checking admin existence:', error);
      throw error;
    }
    
    return !!data; // Ensure we consistently return a boolean
  } catch (error) {
    console.error('Error checking admin existence:', error);
    throw error;
  }
}

// Check if a user has admin role - using fixed secure function
export async function checkIsAdmin(userId: string): Promise<boolean> {
  try {
    if (!userId) return false;
    
    const { data, error } = await supabase.rpc('is_admin_secure_fixed', { 
      _user_id: userId 
    });
    
    if (error) {
      console.error('Error checking admin status:', error);
      throw error;
    }
    
    return !!data; // Ensure we consistently return a boolean
  } catch (error) {
    console.error('Error checking admin status:', error);
    throw error;
  }
}
