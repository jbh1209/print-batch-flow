
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '@/types/user-types';

// Simple profile fetch with better error handling
export const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Profile fetch failed (non-critical):', error.message);
      return null;
    }
    
    return data;
  } catch (error) {
    console.warn('Profile fetch error (non-critical):', error);
    return null;
  }
};

// Use the new secure admin check function
export const checkIsAdmin = async (userId: string): Promise<boolean> => {
  try {
    if (!userId) return false;
    
    const { data, error } = await supabase.rpc('check_user_admin_status', { 
      check_user_id: userId 
    });
    
    if (error) {
      console.warn('Admin check failed (non-critical):', error.message);
      return false;
    }

    return !!data;
  } catch (error) {
    console.warn('Admin check error (non-critical):', error);
    return false;
  }
};

// Load user data with proper error boundaries
export const loadUserData = async (userId: string) => {
  try {
    const [profileData, adminStatus] = await Promise.allSettled([
      fetchProfile(userId),
      checkIsAdmin(userId)
    ]);
    
    const profile = profileData.status === 'fulfilled' ? profileData.value : null;
    const isAdmin = adminStatus.status === 'fulfilled' ? adminStatus.value : false;
    
    return { profile, isAdmin };
  } catch (error) {
    console.warn('User data loading failed (non-critical):', error);
    return { profile: null, isAdmin: false };
  }
};
