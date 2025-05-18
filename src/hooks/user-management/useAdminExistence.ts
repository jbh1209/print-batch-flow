
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook for checking and managing admin existence
 */
export function useAdminExistence() {
  // Check if any admin exists in the system
  const checkAdminExists = useCallback(async (): Promise<boolean> => {
    try {
      // Direct table query to check if admin exists
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('role', 'admin')
        .limit(1);
      
      if (error) {
        toast.error(`Error checking admin existence: ${error.message}`);
        throw error;
      }
      
      return Array.isArray(data) && data.length > 0;
    } catch (error: any) {
      console.error('Error checking admin existence:', error);
      toast.error(`Error checking if admin exists: ${error.message}`);
      return false;
    }
  }, []);
  
  return { checkAdminExists };
}
