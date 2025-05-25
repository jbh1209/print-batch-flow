
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

  const checkAdminStatus = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('check_user_admin_status', { 
        check_user_id: userId 
      });
      
      if (error) {
        console.warn('Admin status check failed:', error.message);
        return false;
      }
      
      return !!data;
    } catch (error) {
      console.warn('Admin status check error:', error);
      return false;
    }
  };

  const checkIfAnyAdminExists = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.warn('Admin existence check failed:', error.message);
        return false;
      }
      
      return !!data;
    } catch (error) {
      console.warn('Admin existence check error:', error);
      return false;
    }
  };

  const refreshAdminStatus = async () => {
    if (authLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      // Check if any admin exists first
      const anyAdminExists = await checkIfAnyAdminExists();
      setAdminExists(anyAdminExists);

      // If user is logged in, check their admin status
      if (user?.id) {
        const userIsAdmin = await checkAdminStatus(user.id);
        setIsAdmin(userIsAdmin);
      } else {
        setIsAdmin(false);
      }
    } catch (error: any) {
      console.error('Admin status refresh failed:', error);
      setError(error.message || 'Failed to check admin status');
      setIsAdmin(false);
      setAdminExists(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Load admin status when auth completes
  useEffect(() => {
    if (!authLoading) {
      // Add small delay to ensure auth state is fully settled
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
