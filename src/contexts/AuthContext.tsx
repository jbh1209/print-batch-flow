
import { createContext, useContext, useEffect, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AuthContextType } from '@/types/auth-types';
import { useAuthState } from '@/hooks/useAuthState';
import { useProfileManagement } from '@/hooks/useProfileManagement';
import { cleanupAuthState } from '@/services/auth/authService';

// Create context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  isAdmin: false,
  isLoading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  refreshSession: async () => null,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const {
    user, setUser,
    profile, setProfile,
    session, setSession,
    isAdmin, setIsAdmin,
    isLoading, setIsLoading
  } = useAuthState();
  
  const { fetchProfile, checkAdmin } = useProfileManagement();

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
      
      const adminStatus = await checkAdmin(user.id);
      setIsAdmin(adminStatus);
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  // Set up auth state listener
  useEffect(() => {
    let isMounted = true;
    
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
              
              const adminStatus = await checkAdmin(currentSession.user.id);
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
            
            const adminStatus = await checkAdmin(currentSession.user.id);
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

  // Create context value
  const value = {
    user,
    profile,
    session,
    isAdmin,
    isLoading,
    signOut: handleSignOut,
    refreshProfile,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};
