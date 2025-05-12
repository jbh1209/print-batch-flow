
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { isPreviewMode } from '@/services/previewService';

/**
 * Enhanced hook for validating user sessions with improved security
 */
export const useSessionValidation = () => {
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const validateSession = async () => {
      setIsValidating(true);
      try {
        // In preview mode, sessions are always valid
        if (isPreviewMode()) {
          setIsValid(true);
          return;
        }
        
        if (!user) {
          setIsValid(false);
          return;
        }
        
        // Check if the session is valid using multiple approaches
        const { data, error } = await supabase.auth.getSession();
        
        if (error || !data.session) {
          console.error('Session validation error:', error);
          
          // Try one more time with refreshing the session
          try {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError || !refreshData.session) {
              console.error('Session refresh error:', refreshError);
              setIsValid(false);
              return;
            }
            
            // Session refreshed successfully
            setIsValid(true);
            return;
          } catch (refreshError) {
            console.error('Error refreshing session:', refreshError);
            setIsValid(false);
            return;
          }
        }
        
        // Also check token expiration
        if (data.session.expires_at) {
          const expiresAt = new Date(data.session.expires_at * 1000);
          if (expiresAt <= new Date()) {
            console.warn("Session token has expired");
            setIsValid(false);
            return;
          }
        }
        
        // If we got this far, session is valid
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
