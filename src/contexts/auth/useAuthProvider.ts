
import { useState, useEffect } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { isPreviewMode, getMockUserData, simulateApiDelay } from '@/services/previewService';
import { UserProfile } from './types';
import { toast } from 'sonner';
import { checkUserIsAdmin } from '@/services/user';

// Clean up auth state
export const cleanupAuthState = () => {
  try {
    console.log('Cleaning up auth state');
    
    // Remove standard auth tokens
    localStorage.removeItem('supabase.auth.token');
    
    // Remove all Supabase auth keys from localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        console.log(`Removing auth key from localStorage: ${key}`);
        localStorage.removeItem(key);
      }
    });
    
    // Clean sessionStorage if used
    if (typeof sessionStorage !== 'undefined') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          console.log(`Removing auth key from sessionStorage: ${key}`);
          sessionStorage.removeItem(key);
        }
      });
    }
    
    console.log('Auth state cleanup completed');
  } catch (error) {
    console.error('Error cleaning up auth state:', error);
  }
};

// Auth provider hook with improved error handling
export function useAuthProvider() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
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

  // Sign out function with cleanup and fallbacks
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
      toast.error('Sign out failed. Please try again.');
      
      // Force reload as last resort
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  // Refresh session token
  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Error refreshing session:', error);
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

  // Set up auth state listener
  useEffect(() => {
    let isMounted = true;

    // For preview mode, set a mock session
    if (isPreviewMode()) {
      console.log('Preview mode detected, using mock authentication');
      simulateApiDelay(300, 700).then(() => {
        if (isMounted) {
          const mockData = getMockUserData();
          
          // Create mock user
          const mockUser = {
            id: mockData.id,
            email: mockData.email,
            role: 'authenticated',
          } as SupabaseUser;
          
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
        }
      });
      
      return () => { isMounted = false; };
    }
    
    // Set up auth listener first to avoid race conditions
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!isMounted) return;
      
      console.log('Auth state changed:', event);
      setSession(currentSession);
      
      // Only continue auth flow for key events
      if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'TOKEN_REFRESHED'].includes(event)) {
        if (currentSession?.user) {
          setUser(currentSession.user);
          
          // Defer other operations to avoid deadlock
          setTimeout(async () => {
            if (!isMounted) return;
            
            try {
              // Fetch profile 
              const profileData = await fetchProfile(currentSession.user.id);
              if (isMounted) {
                setProfile(profileData);
              }
              
              // Check admin status
              const adminStatus = await checkUserIsAdmin(currentSession.user.id);
              if (isMounted) {
                setIsAdmin(adminStatus);
              }
            } finally {
              if (isMounted) {
                setIsLoading(false);
              }
            }
          }, 50);
        } else {
          // User signed out
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          setIsLoading(false);
        }
      }
    });

    // Then check for existing session
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      
      const currentSession = data?.session;
      setSession(currentSession);
      
      if (currentSession?.user) {
        setUser(currentSession.user);
        
        // Defer other operations
        setTimeout(async () => {
          if (!isMounted) return;
          
          try {
            // Fetch profile
            const profileData = await fetchProfile(currentSession.user.id);
            if (isMounted) {
              setProfile(profileData);
            }
            
            // Check admin status
            const adminStatus = await checkUserIsAdmin(currentSession.user.id);
            if (isMounted) {
              setIsAdmin(adminStatus);
            }
          } finally {
            if (isMounted) {
              setIsLoading(false);
            }
          }
        }, 50);
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
