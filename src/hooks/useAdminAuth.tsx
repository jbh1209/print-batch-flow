
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AdminAuthState {
  isAdmin: boolean;
  adminExists: boolean;
  isLoading: boolean;
  error: string | null;
  refreshAdminStatus: () => Promise<void>;
}

export const useAdminAuth = (): AdminAuthState => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminExists, setAdminExists] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAdminStatus = async (): Promise<{ isAdmin: boolean; adminExists: boolean }> => {
    try {
      console.log('🔍 Checking admin status for user:', user?.id);
      
      // Use the new comprehensive RPC function
      const { data, error } = await supabase.rpc('get_admin_status', { 
        check_user_id: user?.id || null 
      });
      
      if (error) {
        console.error('❌ Admin status check failed:', error);
        throw error;
      }
      
      const result = data?.[0] || { user_is_admin: false, any_admin_exists: false };
      console.log('✅ Admin status result:', result);
      
      return {
        isAdmin: result.user_is_admin,
        adminExists: result.any_admin_exists
      };
    } catch (error: any) {
      console.error('❌ Error in admin status check:', error);
      throw new Error(`Admin status check failed: ${error.message}`);
    }
  };

  const refreshAdminStatus = async () => {
    // Don't proceed if auth is still loading
    if (authLoading) {
      console.log('⏳ Auth still loading, skipping admin status check');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { isAdmin: userIsAdmin, adminExists: anyAdminExists } = await checkAdminStatus();
      
      setIsAdmin(userIsAdmin);
      setAdminExists(anyAdminExists);
      
      console.log('✅ Admin status updated:', { 
        userIsAdmin, 
        anyAdminExists, 
        userId: user?.id 
      });
    } catch (error: any) {
      console.error('❌ Failed to refresh admin status:', error);
      setError(error.message);
      setIsAdmin(false);
      setAdminExists(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Load admin status when auth state changes
  useEffect(() => {
    if (!authLoading) {
      console.log('🔄 Auth loading complete, checking admin status');
      // Small delay to ensure auth state is fully settled
      const timer = setTimeout(refreshAdminStatus, 100);
      return () => clearTimeout(timer);
    }
  }, [authLoading, user?.id]);

  return {
    isAdmin,
    adminExists,
    isLoading: authLoading || isLoading,
    error,
    refreshAdminStatus
  };
};
