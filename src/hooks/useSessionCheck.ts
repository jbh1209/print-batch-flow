
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useCallback } from "react";
import { handleAuthError, getFreshAuthToken } from "@/services/auth/authService";

/**
 * Hook for checking session validity with improved error handling
 */
export const useSessionCheck = () => {
  const navigate = useNavigate();
  
  /**
   * Validates that the user has an active session
   * @returns User ID if session is valid, null otherwise
   */
  const validateSession = useCallback(async (): Promise<string | null> => {
    try {
      console.log("Validating user session...");
      
      // Check if user is authenticated directly from the session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("Session validation error:", sessionError);
        await handleAuthError(sessionError);
        return null;
      }
      
      // If no session and auth required, redirect
      if (!sessionData.session) {
        console.log("No active session found");
        toast.error("Authentication required. Please sign in.");
        navigate('/auth', { replace: true });
        return null;
      }
      
      // Get fresh token as a verification step
      const token = sessionData.session.access_token;
      if (!token) {
        console.log("No valid token in session");
        toast.error("Authentication required. Please sign in.");
        navigate('/auth', { replace: true });
        return null;
      }
      
      console.log("Valid session found for user:", sessionData.session.user.id);
      return sessionData.session.user.id;
    } catch (error) {
      console.error("Session validation error:", error);
      await handleAuthError(error);
      return null;
    }
  }, [navigate]);
  
  return { validateSession };
};
