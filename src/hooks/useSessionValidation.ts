
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useSessionValidation = () => {
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const validateSession = async () => {
      setIsValidating(true);
      try {
        if (!user) {
          setIsValid(false);
          return;
        }
        
        // Check if the session is valid
        const { data, error } = await supabase.auth.getSession();
        
        if (error || !data.session) {
          console.error('Session validation error:', error);
          setIsValid(false);
          return;
        }
        
        setIsValid(true);
      } catch (error) {
        console.error('Error validating session:', error);
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateSession();
  }, [user]);

  return { isValidating, isValid };
};
