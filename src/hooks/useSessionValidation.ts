
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { handleAuthError } from '@/services/auth/authService';

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
  
  // Use refs to prevent duplicate API calls and infinite loops
  const isMounted = useRef(true);
  const validationInProgress = useRef(false);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Function to validate session with improved error handling
  const validateSession = useCallback(async (): Promise<void> => {
    // Skip if already validating or component unmounted
    if (validationInProgress.current || !isMounted.current) {
      return;
    }
    
    try {
      console.log("Running session validation...");
      setIsValidating(true);
      validationInProgress.current = true;
      
      // Get session directly without trying to get a fresh token first
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session validation error:', error);
        if (requireAuth && isMounted.current) {
          toast.error("Authentication required. Please sign in.");
          navigate('/auth', { replace: true });
        }
        if (isMounted.current) {
          setIsValid(false);
        }
        return;
      }
      
      // If no session and auth required, redirect
      if (!session) {
        console.log("No active session found");
        if (requireAuth && isMounted.current) {
          toast.error("Authentication required. Please sign in.");
          navigate('/auth', { replace: true });
        }
        if (isMounted.current) {
          setIsValid(false);
        }
        return;
      }
      
      // If we have a session, store the userId
      if (session && isMounted.current) {
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
          if (isMounted.current) {
            setIsAdmin(false);
          }
          if (requireAdmin && isMounted.current) {
            toast.error("Admin access required for this page");
            navigate('/', { replace: true });
          }
          if (isMounted.current) {
            setIsValid(false);
          }
          return;
        }
        
        if (!isAdminUser && requireAdmin) {
          console.log("User lacks admin privileges");
          if (isMounted.current) {
            toast.error("You don't have admin privileges required for this page");
            navigate('/', { replace: true });
          }
          if (isMounted.current) {
            setIsValid(false);
          }
          return;
        }
        
        if (isMounted.current) {
          setIsAdmin(!!isAdminUser);
        }
      }
      
      // Mark session as valid if we get here
      if (isMounted.current) {
        setIsValid(true);
        setLastValidated(Date.now());
      }
    } catch (error) {
      console.error('Session validation exception:', error);
      await handleAuthError(error);
      if (isMounted.current) {
        setIsValid(false);
      }
    } finally {
      if (isMounted.current) {
        setIsValidating(false);
      }
      validationInProgress.current = false;
    }
  }, [navigate, requireAuth, requireAdmin]);
  
  // Effect to validate session on mount and periodically
  useEffect(() => {
    // Initial validation
    validateSession();
    
    // Set up periodic re-validation (every 5 minutes)
    const interval = setInterval(() => {
      if (isMounted.current && (Date.now() - lastValidated) > 5 * 60 * 1000) {
        console.log("Periodic session re-validation");
        validateSession();
      }
    }, 60 * 1000); // Check every minute, but only revalidate after 5 minutes
    
    return () => {
      clearInterval(interval);
    };
  }, [validateSession, lastValidated]);
  
  return { isValidating, isValid, isAdmin, userId, validateSession };
}
