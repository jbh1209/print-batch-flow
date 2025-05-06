
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
          if (requireAuth && isMounted) {
            toast.error("Authentication required. Please sign in.");
            navigate('/auth');
          }
          return;
        }
        
        // If no session and auth required, redirect
        if (!session && requireAuth) {
          if (isMounted) {
            toast.error("Authentication required. Please sign in.");
            navigate('/auth');
          }
          return;
        }
        
        // If we have a session and require admin status
        if (session && requireAdmin) {
          const { data: isAdminUser, error: adminError } = await supabase.rpc(
            'is_admin_secure_fixed', { _user_id: session.user.id }
          );
          
          if (adminError) {
            console.error('Admin validation error:', adminError);
            setIsAdmin(false);
            if (requireAdmin && isMounted) {
              toast.error("Admin access required for this page");
              navigate('/');
            }
            return;
          }
          
          if (!isAdminUser && requireAdmin) {
            if (isMounted) {
              toast.error("You don't have admin privileges required for this page");
              navigate('/');
            }
            return;
          }
          
          if (isMounted) {
            setIsAdmin(!!isAdminUser);
          }
        }
        
        // Mark session as valid if we get here
        if (isMounted) {
          setIsValid(true);
          setIsValidating(false);
        }
      } catch (error) {
        console.error('Session validation exception:', error);
        if (requireAuth && isMounted) {
          toast.error("Authentication error. Please sign in again.");
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
