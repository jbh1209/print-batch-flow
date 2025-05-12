
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { isPreviewMode } from '@/services/previewService';
import { cleanupAuthState } from '@/services/security/securityService';

/**
 * Enhanced hook for checking session validity with improved security
 */
export const useSessionCheck = () => {
  const navigate = useNavigate();
  
  /**
   * Validates that the user has an active session with enhanced security
   * @returns User ID if session is valid, null otherwise
   */
  const validateSession = async (): Promise<string | null> => {
    // In preview mode, return a mock user ID
    if (isPreviewMode()) {
      console.log("Preview mode detected, skipping session validation");
      return "preview-user-id";
    }
    
    try {
      console.log("Validating user session...");
      
      // Check if user is authenticated
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("Session error:", sessionError);
        throw sessionError;
      }
      
      if (!sessionData.session) {
        console.log("No active session found");
        
        // Try to refresh session one time
        try {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError || !refreshData.session) {
            console.error("Session refresh failed:", refreshError);
            throw new Error("Session expired");
          }
          
          console.log("Session refreshed successfully");
          return refreshData.session.user.id;
        } catch (refreshError) {
          // Clean up any stale auth state
          cleanupAuthState();
          
          toast.error("Authentication required. Please sign in.");
          navigate('/auth');
          return null;
        }
      }
      
      // Also check token expiration
      if (sessionData.session.expires_at) {
        const expiresAt = new Date(sessionData.session.expires_at * 1000);
        if (expiresAt <= new Date()) {
          console.warn("Session token has expired");
          
          // Clean up any stale auth state
          cleanupAuthState();
          
          toast.error("Your session has expired. Please sign in again.");
          navigate('/auth');
          return null;
        }
      }
      
      console.log("Valid session found for user:", sessionData.session.user.id);
      return sessionData.session.user.id;
    } catch (error) {
      console.error("Session validation error:", error);
      
      // Clean up any stale auth state
      cleanupAuthState();
      
      toast.error("Authentication error. Please sign in again.");
      navigate('/auth');
      return null;
    }
  };
  
  return { validateSession };
};
