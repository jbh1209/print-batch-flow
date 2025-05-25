
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '@/types/user-types';

interface OptionalUserData {
  profile: UserProfile | null;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useOptionalUserData = (userId: string | undefined) => {
  const [data, setData] = useState<OptionalUserData>({
    profile: null,
    isAdmin: false,
    isLoading: true,
    error: null
  });

  useEffect(() => {
    if (!userId) {
      setData({
        profile: null,
        isAdmin: false,
        isLoading: false,
        error: null
      });
      return;
    }

    const loadData = async () => {
      try {
        setData(prev => ({ ...prev, isLoading: true, error: null }));

        // Load profile data
        const profilePromise = supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        // Use the new secure admin check function
        const adminPromise = supabase.rpc('check_user_admin_status', { 
          check_user_id: userId 
        });

        const [profileResult, adminResult] = await Promise.allSettled([
          profilePromise,
          adminPromise
        ]);

        let profile = null;
        let isAdmin = false;

        if (profileResult.status === 'fulfilled' && !profileResult.value.error) {
          profile = profileResult.value.data;
        }

        if (adminResult.status === 'fulfilled' && !adminResult.value.error) {
          isAdmin = !!adminResult.value.data;
        }

        setData({
          profile,
          isAdmin,
          isLoading: false,
          error: null
        });

      } catch (error) {
        console.warn('Optional user data loading failed:', error);
        setData({
          profile: null,
          isAdmin: false,
          isLoading: false,
          error: 'Failed to load user data'
        });
      }
    };

    loadData();
  }, [userId]);

  return data;
};
