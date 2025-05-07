
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to validate user session
 */
export const useSessionValidation = () => {
  const { user } = useAuth();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const validateSession = async () => {
      setIsValidating(true);
      
      try {
        // If no user, we know session is not valid
        if (!user) {
          setIsValid(false);
          return;
        }
        
        // Verify the session is still valid with Supabase
        const { data, error } = await supabase.auth.getSession();
        
        if (error || !data.session) {
          console.error("Session validation error:", error);
          setIsValid(false);
          return;
        }
        
        setIsValid(true);
      } catch (error) {
        console.error("Session validation exception:", error);
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateSession();
  }, [user]);

  return { isValidating, isValid };
};

export default useSessionValidation;
