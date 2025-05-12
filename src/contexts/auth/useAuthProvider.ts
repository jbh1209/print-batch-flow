
import { useState, useEffect } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from './types';
import { cleanupAuthState, checkIsAdmin } from '@/services/auth/authService';
import { toast } from 'sonner';

// Check if we're in Lovable preview mode
const isLovablePreview = 
  typeof window !== 'undefined' && 
  (window.location.hostname.includes('gpteng.co') || window.location.hostname.includes('lovable.dev'));

export function useAuthProvider() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile with retry
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

  // Check if user is admin using the enhanced method
  const checkAdmin = async (userId: string, userEmail?: string | null) => {
    if (!userId) return false;
    
    try {
      // Use the enhanced admin checking function with multiple strategies
      const isUserAdmin = await checkIsAdmin(userId, userEmail);
      return isUserAdmin;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  };

  // Sign out function
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
      
      const adminStatus = await checkAdmin(user.id, user.email);
      setIsAdmin(adminStatus);
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  // Set up auth state listener
  useEffect(() => {
    let isMounted = true;

    // For preview mode, set a mock session to allow navigation
    if (isLovablePreview) {
      console.log('Preview mode detected, using mock authentication');
      setIsLoading(false);
      
      // Only if in preview - create a mock user for easier navigation
      // This will not persist or affect real authentication
      const mockUser = {
        id: 'preview-user',
        email: 'preview@example.com',
        role: 'authenticated',
      } as SupabaseUser;
      
      const mockProfile = {
        id: 'preview-user',
        full_name: 'Preview User',
        avatar_url: null,
      };

      // Set mock data for preview
      setUser(mockUser);
      setProfile(mockProfile);
      setIsAdmin(true);
      return;
    }
    
    // Set up auth state listener FIRST to avoid missing events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!isMounted) return;
        
        console.log('Auth state changed:', event);
        setSession(currentSession);
        
        if (currentSession?.user) {
          setUser(currentSession.user);
          
          // Defer profile fetching to avoid recursive RLS issues
          setTimeout(async () => {
            if (!isMounted) return;
            
            try {
              const profileData = await fetchProfile(currentSession.user.id);
              if (isMounted) {
                setProfile(profileData);
              }
              
              const adminStatus = await checkAdmin(currentSession.user.id, currentSession.user.email);
              if (isMounted) {
                setIsAdmin(adminStatus);
              }
            } finally {
              if (isMounted) {
                setIsLoading(false);
              }
            }
          }, 100);
        } else {
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          setIsLoading(false);
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!isMounted) return;
      
      setSession(currentSession);
      
      if (currentSession?.user) {
        setUser(currentSession.user);
        
        // Defer profile fetching
        setTimeout(async () => {
          if (!isMounted) return;
          
          try {
            const profileData = await fetchProfile(currentSession.user.id);
            if (isMounted) {
              setProfile(profileData);
            }
            
            const adminStatus = await checkAdmin(currentSession.user.id, currentSession.user.email);
            if (isMounted) {
              setIsAdmin(adminStatus);
            }
          } finally {
            if (isMounted) {
              setIsLoading(false);
            }
          }
        }, 100);
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
