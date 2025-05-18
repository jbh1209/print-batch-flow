
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

/**
 * Hook for checking session validity
 */
export const useSessionCheck = () => {
  const navigate = useNavigate();
  
  /**
   * Validates that the user has an active session
   * @returns User ID if session is valid, null otherwise
   */
  const validateSession = async (): Promise<string | null> => {
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
        toast.error("Authentication required. Please sign in.");
        navigate('/auth');
        return null;
      }
      
      console.log("Valid session found for user:", sessionData.session.user.id);
      return sessionData.session.user.id;
    } catch (error) {
      console.error("Session validation error:", error);
      toast.error("Authentication error. Please sign in again.");
      navigate('/auth');
      return null;
    }
  };
  
  return { validateSession };
};
