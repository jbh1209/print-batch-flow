
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { isPreviewMode } from '@/services/previewService';
import { toast } from 'sonner';

interface SessionValidationResult {
  isValidating: boolean;
  isValid: boolean;
  tokenExpiresAt: Date | null;
  refreshSession: () => Promise<boolean>;
  validateToken: () => Promise<boolean>;
}

/**
 * Enhanced hook for validating user sessions with improved security
 */
export const useSecureSessionValidation = (): SessionValidationResult => {
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<Date | null>(null);
  const { user, session, refreshSession: authRefreshSession } = useAuth();

  // Verify token validity with security checks
  const validateToken = useCallback(async (): Promise<boolean> => {
    try {
      // In preview mode, tokens are always valid
      if (isPreviewMode()) {
        return true;
      }
      
      if (!session?.access_token) {
        return false;
      }
      
      // Check token expiration time
      if (session.expires_at) {
        const expiresAt = new Date(session.expires_at * 1000);
        setTokenExpiresAt(expiresAt);
        
        // If token is expired or about to expire (within 5 minutes)
        const now = new Date();
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
        
        if (expiresAt <= now) {
          console.warn("Token has expired");
          return false;
        }
        
        if (expiresAt <= fiveMinutesFromNow) {
          console.warn("Token is about to expire, refreshing");
          return await refreshSession();
        }
      }
      
      // Validate by making a lightweight authenticated request
      const { error } = await supabase.auth.getUser();
      
      if (error) {
        console.error("Token validation error:", error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Error validating token:", error);
      return false;
    }
  }, [session]);

  // Refresh the session if needed
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      // In preview mode, just return true
      if (isPreviewMode()) {
        return true;
      }
      
      // Attempt to refresh the session
      const refreshResult = await authRefreshSession();
      
      if (!refreshResult) {
        console.error("Failed to refresh session");
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Error refreshing session:", error);
      return false;
    }
  }, [authRefreshSession]);

  // Validate session on component mount and when dependencies change
  useEffect(() => {
    const performValidation = async () => {
      setIsValidating(true);
      try {
        // In preview mode, sessions are always valid
        if (isPreviewMode()) {
          setIsValid(true);
          setIsValidating(false);
          return;
        }
        
        if (!user) {
          setIsValid(false);
          setIsValidating(false);
          return;
        }
        
        const isTokenValid = await validateToken();
        setIsValid(isTokenValid);
      } catch (error) {
        console.error('Error validating session:', error);
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    performValidation();
  }, [user, validateToken]);

  return { 
    isValidating, 
    isValid, 
    tokenExpiresAt,
    refreshSession,
    validateToken
  };
};
