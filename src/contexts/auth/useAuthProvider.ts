
import { useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from './types';
import { checkUserIsAdmin, cleanupAuthState } from '@/services/auth/authService';
import { isPreviewMode, getMockUserData } from '@/services/previewService';

/**
 * Auth provider hook with improved error handling and simplified structure
 */
export function useAuthProvider() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile with better error handling
  const fetchProfile = async (userId: string) => {
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

  // Sign out function with cleanup
  const handleSignOut = async () => {
    try {
      // First clean up all auth state
      cleanupAuthState();
      
      // Then attempt sign out
      await supabase.auth.signOut({ scope: 'global' });
      
      // Clear state
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsAdmin(false);
      
      // Force page reload to ensure clean state
      window.location.href = '/auth';
    } catch (error) {
      console.error('Error signing out:', error);
      
      // Force reload as last resort
      window.location.href = '/auth';
    }
  };

  // Refresh session token
  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        return null;
      }
      
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        return data.session;
      }
      
      return null;
    } catch (error) {
      console.error('Error refreshing session:', error);
      return null;
    }
  };

  // Refresh user profile
  const refreshProfile = async () => {
    if (!user?.id) return;
    
    try {
      const profileData = await fetchProfile(user.id);
      if (profileData) {
        setProfile(profileData);
      }
      
      const adminStatus = await checkUserIsAdmin(user.id);
      setIsAdmin(adminStatus);
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Handle preview mode
    if (isPreviewMode()) {
      console.log('Preview mode detected, using mock authentication');
      
      const setupPreview = async () => {
        const mockData = getMockUserData();
        
        // Create mock user
        const mockUser = {
          id: mockData.id,
          email: mockData.email,
        } as User;
        
        // Create mock profile
        const mockProfile = {
          id: mockData.id,
          full_name: mockData.full_name,
          avatar_url: null,
        };

        // Set mock data
        setUser(mockUser);
        setProfile(mockProfile);
        setIsAdmin(true);
        setIsLoading(false);
      };
      
      setupPreview();
      return () => { isMounted = false; };
    }
    
    // Set up auth listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!isMounted) return;
      
      setSession(currentSession);
      
      if (currentSession?.user) {
        setUser(currentSession.user);
        
        // Defer profile loading to prevent circular requests
        setTimeout(async () => {
          if (!isMounted) return;
          
          // Fetch profile
          const profileData = await fetchProfile(currentSession.user.id);
          if (isMounted) setProfile(profileData);
          
          // Check admin status
          const adminStatus = await checkUserIsAdmin(currentSession.user.id);
          if (isMounted) setIsAdmin(adminStatus);
          
          if (isMounted) setIsLoading(false);
        }, 0);
      } else {
        // User signed out
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setIsLoading(false);
      }
    });

    // Then check for existing session
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      
      const currentSession = data?.session;
      setSession(currentSession);
      
      if (currentSession?.user) {
        setUser(currentSession.user);
        
        // Defer profile loading to prevent circular requests
        setTimeout(async () => {
          if (!isMounted) return;
          
          // Fetch profile
          const profileData = await fetchProfile(currentSession.user.id);
          if (isMounted) setProfile(profileData);
          
          // Check admin status
          const adminStatus = await checkUserIsAdmin(currentSession.user.id);
          if (isMounted) setIsAdmin(adminStatus);
          
          if (isMounted) setIsLoading(false);
        }, 0);
      } else {
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    profile,
    session,
    isAdmin,
    isLoading,
    signOut: handleSignOut,
    refreshProfile,
    refreshSession,
  };
}
