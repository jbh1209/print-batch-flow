
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '@/types/auth-types';

/**
 * Hook containing profile management functionality
 */
export const useProfileManagement = () => {
  /**
   * Fetch user profile with retry
   */
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    if (!userId) return null;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      
      return data as UserProfile;
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      return null;
    }
  };

  /**
   * Check if user is admin
   */
  const checkAdmin = async (userId: string): Promise<boolean> => {
    if (!userId) return false;
    
    try {
      const { data, error } = await supabase
        .rpc('is_admin_secure_fixed', { _user_id: userId });
      
      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }
      
      return !!data;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  };

  return {
    fetchProfile,
    checkAdmin
  };
};
