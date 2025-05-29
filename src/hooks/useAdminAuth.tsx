
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
      console.log('🔍 Checking admin status with new clean function...');
      
      // Use the new simplified is_admin function with correct parameter name
      const { data: isAdminData, error: isAdminError } = await supabase.rpc('is_admin', { 
        _user_id: user?.id || null 
      });
      
      if (isAdminError) {
        console.error('❌ Admin check failed:', isAdminError);
        throw isAdminError;
      }
      
      // Check if any admin exists using the existing function
      const { data: adminExistsData, error: adminExistsError } = await supabase.rpc('any_admin_exists');
      
      if (adminExistsError) {
        console.error('❌ Admin exists check failed:', adminExistsError);
        throw adminExistsError;
      }
      
      console.log('✅ Admin status result:', { isAdmin: isAdminData, adminExists: adminExistsData });
      
      return {
        isAdmin: !!isAdminData,
        adminExists: !!adminExistsData
      };
    } catch (error: any) {
      console.error('❌ Error in admin status check:', error);
      throw new Error(`Admin status check failed: ${error.message}`);
    }
  };

  const refreshAdminStatus = async () => {
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
      
      console.log('✅ Admin status updated successfully:', { 
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

  useEffect(() => {
    if (!authLoading) {
      console.log('🔄 Auth loading complete, checking admin status');
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
