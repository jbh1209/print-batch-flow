
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isPreviewMode, simulateApiCall } from '@/services/previewService';
import { toast } from 'sonner';

/**
 * Hook for admin-related security checks and role management
 */
export function useAdminChecks(fetchUsers: () => Promise<void>) {
  const [anyAdminExists, setAnyAdminExists] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if any admin exists in the system with improved error handling
  const checkAdminExists = useCallback(async () => {
    try {
      setError(null);
      
      // In preview mode, always return true for testing
      if (isPreviewMode()) {
        setAnyAdminExists(true);
        return true;
      }
      
      const { data, error } = await supabase.rpc('any_admin_exists');
      
      if (error) {
        console.error("Error checking admin existence:", error);
        // Try a fallback direct query if RPC fails
        const { count, error: countError } = await supabase
          .from('user_roles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'admin');
          
        if (countError) {
          throw countError;
        }
        
        const exists = count !== null && count > 0;
        setAnyAdminExists(exists);
        return exists;
      }
      
      const exists = !!data;
      setAnyAdminExists(exists);
      return exists;
    } catch (error: any) {
      console.error('Error checking admin existence:', error);
      setError(`Error checking if admin exists: ${error.message}`);
      // Default to assuming admin exists to prevent unintended privilege escalation
      setAnyAdminExists(false);
      return false;
    }
  }, []);

  // Add admin role to a user with enhanced security
  const addAdminRole = useCallback(async (userId: string) => {
    try {
      if (!userId) {
        throw new Error('Invalid user ID');
      }
      
      if (isPreviewMode()) {
        await simulateApiCall(600, 1000);
        setAnyAdminExists(true);
        toast.success('Admin role successfully assigned (Preview Mode)');
        return;
      }
      
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      
      if (!session?.access_token) {
        throw new Error('Authentication token missing or expired. Please sign in again.');
      }
      
      const { error } = await supabase.rpc('set_user_role_admin', {
        _target_user_id: userId,
        _new_role: 'admin'
      });
      
      if (error) {
        throw error;
      }
      
      setAnyAdminExists(true);
      toast.success('Admin role successfully assigned');
      await fetchUsers();
    } catch (error: any) {
      console.error('Error setting admin role:', error);
      toast.error(`Failed to set admin role: ${error.message}`);
      throw error;
    }
  }, [fetchUsers]);

  return {
    anyAdminExists,
    error,
    checkAdminExists,
    addAdminRole,
    setError // Exposing this to allow other hooks to update error
  };
}
