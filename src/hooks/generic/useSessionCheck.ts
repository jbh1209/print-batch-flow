
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
      // Check if user is authenticated
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error("Authentication required. Please sign in.");
        navigate('/auth');
        return null;
      }
      
      return session.session.user.id;
    } catch (error) {
      console.error("Session validation error:", error);
      toast.error("Authentication error. Please sign in again.");
      navigate('/auth');
      return null;
    }
  };
  
  return { validateSession };
};
