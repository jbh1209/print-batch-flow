
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useCallback, useRef } from "react";

/**
 * Consolidated hook for checking session validity
 * This replaces the duplicate session validation logic across multiple hooks
 */
export const useSessionCheck = () => {
  const navigate = useNavigate();
  const validationInProgress = useRef(false);
  
  /**
   * Validates that the user has an active session
   * @returns User ID if session is valid, null otherwise
   */
  const validateSession = useCallback(async (): Promise<string | null> => {
    // Prevent multiple concurrent validation calls
    if (validationInProgress.current) {
      return null;
    }
    
    try {
      validationInProgress.current = true;
      
      // Check if user is authenticated directly from the session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("Session error:", sessionError);
        toast.error("Authentication error. Please sign in again.");
        navigate('/auth', { replace: true });
        return null;
      }
      
      // If no session and auth required, redirect
      if (!sessionData.session) {
        toast.error("Authentication required. Please sign in.");
        navigate('/auth', { replace: true });
        return null;
      }
      
      // Get fresh token as a verification step
      const token = sessionData.session.access_token;
      if (!token) {
        toast.error("Authentication required. Please sign in.");
        navigate('/auth', { replace: true });
        return null;
      }
      
      return sessionData.session.user.id;
    } catch (error) {
      console.error("Session validation error:", error);
      toast.error("Authentication error. Please sign in again.");
      navigate('/auth', { replace: true });
      return null;
    } finally {
      validationInProgress.current = false;
    }
  }, [navigate]);
  
  return { validateSession };
};
