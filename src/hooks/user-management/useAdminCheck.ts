
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook for checking if admin exists in the system
 */
export function useAdminCheck(
  setError: (error: string | null) => void,
  setAnyAdminExists: (exists: boolean) => void
) {
  // Check if any admin exists in the system
  const checkAdminExists = useCallback(async () => {
    try {
      setError(null);
      
      // Direct table query to check if admin exists
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('role', 'admin')
        .limit(1);
      
      if (error) {
        throw error;
      }
      
      const exists = Array.isArray(data) && data.length > 0;
      setAnyAdminExists(exists);
      return exists;
    } catch (error: any) {
      console.error('Error checking admin existence:', error);
      setError(`Error checking if admin exists: ${error.message}`);
      setAnyAdminExists(false);
      return false;
    }
  }, [setError, setAnyAdminExists]);

  return { checkAdminExists };
}
