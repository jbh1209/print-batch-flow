
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '@/types/user-types';

// Profile fetch with timeout and retry
export const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
    );
    
    const profilePromise = supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const { data, error } = await Promise.race([profilePromise, timeoutPromise]);

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

// Improved admin check with retry and timeout
export const checkIsAdmin = async (userId: string): Promise<boolean> => {
  try {
    if (!userId) return false;
    
    // Add timeout and retry logic
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Admin check timeout')), 5000)
    );
    
    const adminCheckPromise = supabase.rpc('check_user_admin_status', { 
      check_user_id: userId 
    });
    
    const { data, error } = await Promise.race([adminCheckPromise, timeoutPromise]);
    
    if (error) {
      console.warn('Admin check failed (non-critical):', error.message);
      return false;
    }

    return !!data;
  } catch (error) {
    console.warn('Admin check error (non-critical):', error);
    // Fallback: return false rather than blocking the app
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
