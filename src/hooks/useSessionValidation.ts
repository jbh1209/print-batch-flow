
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { handleAuthError, getFreshAuthToken } from '@/services/auth/authService';

/**
 * Hook to validate user session and manage auth state consistently
 */
export function useSessionValidation(requireAuth = true, requireAdmin = false) {
  const navigate = useNavigate();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [lastValidated, setLastValidated] = useState<number>(0);
  
  // Function to validate session with improved error handling
  const validateSession = useCallback(async (): Promise<void> => {
    try {
      console.log("Running session validation...");
      setIsValidating(true);
      
      // Get fresh token to ensure we're working with valid session
      const token = await getFreshAuthToken();
      
      // Check if user session exists
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session validation error:', error);
        if (requireAuth) {
          toast.error("Authentication required. Please sign in.");
          navigate('/auth');
        }
        setIsValid(false);
        return;
      }
      
      // If no session and auth required, redirect
      if (!session) {
        console.log("No active session found");
        if (requireAuth) {
          toast.error("Authentication required. Please sign in.");
          navigate('/auth');
        }
        setIsValid(false);
        return;
      }
      
      // If we have a session, store the userId
      if (session) {
        setUserId(session.user.id);
      }
      
      // If we have a session and require admin status
      if (session && requireAdmin) {
        // Use the secure fixed function that doesn't rely on RLS
        const { data: isAdminUser, error: adminError } = await supabase.rpc(
          'is_admin_secure_fixed', { _user_id: session.user.id }
        );
        
        if (adminError) {
          console.error('Admin validation error:', adminError);
          setIsAdmin(false);
          if (requireAdmin) {
            toast.error("Admin access required for this page");
            navigate('/');
          }
          setIsValid(false);
          return;
        }
        
        if (!isAdminUser && requireAdmin) {
          console.log("User lacks admin privileges");
          toast.error("You don't have admin privileges required for this page");
          navigate('/');
          setIsValid(false);
          return;
        }
        
        setIsAdmin(!!isAdminUser);
      }
      
      // Mark session as valid if we get here
      setIsValid(true);
      setLastValidated(Date.now());
    } catch (error) {
      console.error('Session validation exception:', error);
      await handleAuthError(error);
      setIsValid(false);
    } finally {
      setIsValidating(false);
    }
  }, [navigate, requireAuth, requireAdmin]);
  
  // Effect to validate session on mount and periodically
  useEffect(() => {
    let isMounted = true;
    
    const doValidation = async () => {
      if (!isMounted) return;
      await validateSession();
    };
    
    // Initial validation
    doValidation();
    
    // Set up periodic re-validation (every 5 minutes)
    const interval = setInterval(() => {
      if (isMounted && (Date.now() - lastValidated) > 5 * 60 * 1000) {
        console.log("Periodic session re-validation");
        doValidation();
      }
    }, 60 * 1000); // Check every minute, but only revalidate after 5 minutes
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [validateSession, lastValidated]);
  
  return { isValidating, isValid, isAdmin, userId, validateSession };
}
