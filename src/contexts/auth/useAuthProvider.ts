
import { useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from './types';
import { cleanupAuthState } from '@/services/auth/authService';
import { isPreviewMode } from '@/services/previewService';

/**
 * Auth provider hook with improved error handling and simplified structure
 * IMPORTANT: This hook ONLY loads essential auth state and does NOT fetch additional user data
 * unless explicitly requested via refreshProfile()
 */
export function useAuthProvider() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile with better error handling - explicitly called only when needed
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

  // ON-DEMAND ONLY: Refresh user profile and admin status
  const refreshProfile = async () => {
    if (!user?.id) return;
    
    try {
      // Fetch profile data
      const profileData = await fetchProfile(user.id);
      if (profileData) {
        setProfile(profileData);
      }
      
      // Check admin status - import dynamically to prevent circular dependencies
      const checkAdminStatusAsync = async () => {
        try {
          const authServiceModule = await import('@/services/auth/authService');
          const adminStatus = await authServiceModule.checkUserIsAdmin(user.id);
          setIsAdmin(adminStatus);
        } catch (error) {
          console.error('Error checking admin status:', error);
        }
      };
      
      // Execute the check asynchronously
      checkAdminStatusAsync();
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Handle preview mode
    if (isPreviewMode()) {
      console.log('Preview mode detected, using mock authentication');
      
      const setupPreview = () => {
        // Use mock user data
        const mockUser = { 
          id: 'preview-user-id', 
          email: 'preview@example.com' 
        } as User;
        
        // Create mock profile
        const mockProfile = {
          id: 'preview-user-id',
          full_name: 'Preview User',
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
      
      console.log('Auth state change:', event);
      setSession(currentSession);
      
      if (currentSession?.user) {
        setUser(currentSession.user);
        
        // IMPORTANT: We do NOT automatically fetch profile or check admin status
        // This is now done on-demand via refreshProfile()
        setIsLoading(false);
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
        // IMPORTANT: We do NOT automatically fetch profile or check admin status
        // This is now done on-demand via refreshProfile()
        setIsLoading(false);
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
