
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

/**
 * Hook to validate user session and manage auth state consistently
 */
export function useSessionValidation(requireAuth = true, requireAdmin = false) {
  const navigate = useNavigate();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    let isMounted = true;
    
    const validateSession = async () => {
      try {
        // Check if user session exists
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session validation error:', error);
          if (requireAuth) navigate('/auth');
          return;
        }
        
        // If no session and auth required, redirect
        if (!session && requireAuth) {
          navigate('/auth');
          return;
        }
        
        // If we have a session and require admin status
        if (session && requireAdmin) {
          const { data: isAdminUser, error: adminError } = await supabase.rpc(
            'is_admin_secure', { _user_id: session.user.id }
          );
          
          if (adminError || !isAdminUser) {
            console.error('Admin validation error:', adminError);
            setIsAdmin(false);
            if (requireAdmin) navigate('/');
            return;
          }
          
          setIsAdmin(true);
        }
        
        // Mark session as valid if we get here
        if (isMounted) {
          setIsValid(true);
          setIsValidating(false);
        }
      } catch (error) {
        console.error('Session validation exception:', error);
        if (requireAuth && isMounted) {
          navigate('/auth');
        }
      } finally {
        if (isMounted) {
          setIsValidating(false);
        }
      }
    };
    
    validateSession();
    
    return () => {
      isMounted = false;
    };
  }, [navigate, requireAuth, requireAdmin]);
  
  return { isValidating, isValid, isAdmin };
}
