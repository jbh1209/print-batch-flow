
import { supabase } from '@/integrations/supabase/client';

/**
 * Base utility functions for user services
 */

// Check if any admin exists in the system
export async function checkAdminExists(): Promise<boolean> {
  try {
    try {
      // Try using the stored procedure first with explicit typecasting
      const { data, error } = await supabase.rpc('any_admin_exists') as any;
      
      if (error) {
        console.error('Error checking admin existence with function:', error);
        throw error;
      }
      
      return !!data; // Ensure we consistently return a boolean
    } catch (error) {
      // Fallback: Query the user_roles table directly if function fails
      console.warn('Falling back to direct query for admin check');
      const { data, error: queryError } = await supabase
        .from('user_roles')
        .select('id')
        .eq('role', 'admin')
        .limit(1);
      
      if (queryError) {
        console.error('Error checking admin with fallback:', queryError);
        throw queryError;
      }
      
      return Array.isArray(data) && data.length > 0;
    }
  } catch (error: any) {
    console.error('Error checking admin existence:', error);
    return false;
  }
}

// Check if a user has admin role - using fixed secure function
export async function checkIsAdmin(userId: string): Promise<boolean> {
  try {
    if (!userId) return false;
    
    try {
      // Try using the stored procedure first with explicit typecasting
      const { data, error } = await supabase.rpc('is_admin_secure_fixed', { 
        _user_id: userId 
      }) as any;
      
      if (error) {
        console.error('Error checking admin status with function:', error);
        throw error;
      }
      
      return !!data; // Ensure we consistently return a boolean
    } catch (error) {
      // Fallback: Query the user_roles table directly if function fails
      console.warn('Falling back to direct query for admin role check');
      const { data, error: queryError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (queryError) {
        console.error('Error checking admin with fallback:', queryError);
        return false;
      }
      
      return !!data;
    }
  } catch (error: any) {
    console.error('Error checking admin status:', error);
    return false;
  }
}
