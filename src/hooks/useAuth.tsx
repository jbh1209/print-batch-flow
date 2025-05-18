import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, UserProfile, UserRole } from '@/types/user-types';
import { Session } from '@supabase/supabase-js';
import { User as AuthUser } from '@supabase/supabase-js'; // Import Supabase's User type as AuthUser

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  checkIsAdmin: (userId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  isLoggedIn: false,
  isAdmin: false,
  isLoading: true,
  signOut: async () => {},
  checkIsAdmin: async () => false,
});

// Helper function to clean up auth state
const cleanupAuthState = () => {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      localStorage.removeItem(key);
    }
  });
  Object.keys(sessionStorage || {}).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      sessionStorage.removeItem(key);
    }
  });
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch user profile from profiles table
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
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
      
      return data;
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      return null;
    }
  };

  // Check if user is an admin using the secure RPC function first
  const checkIsAdmin = async (userId: string): Promise<boolean> => {
    try {
      if (!userId) return false;
      
      // Try secure function first - using the correct function name is_admin_secure_fixed
      try {
        const { data: isAdminSecure, error: secureError } = await supabase
          .rpc('is_admin_secure_fixed', { _user_id: userId });
        
        if (!secureError) {
          return !!isAdminSecure;
        }
        
        console.log('Secure admin check failed, falling back to standard:', secureError);
      } catch (error) {
        console.log('Error in secure admin check:', error);
      }
      
      // Direct database query as a fallback
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }

      return data?.role === 'admin';
    } catch (error) {
      console.error('Error in checkIsAdmin:', error);
      return false;
    }
  };

  // Update admin status
  const updateAdminStatus = async (userId: string) => {
    if (!userId) return;
    try {
      const isAdminUser = await checkIsAdmin(userId);
      setIsAdmin(isAdminUser);
    } catch (error) {
      console.error('Error updating admin status:', error);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    let isSubscribed = true;

    // Set up auth state listener FIRST to avoid missing events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!isSubscribed) return;

        // Update session state
        setSession(newSession);

        // Convert Supabase user to our User type
        if (newSession?.user) {
          const userObj: User = {
            id: newSession.user.id,
            email: newSession.user.email || undefined
          };
          setUser(userObj);

          // Using setTimeout to avoid recursive RLS issues
          setTimeout(async () => {
            if (!isSubscribed) return;
            
            try {
              const profile = await fetchProfile(newSession.user!.id);
              setProfile(profile);
              await updateAdminStatus(newSession.user!.id);
              setLoading(false);
            } catch (error) {
              console.error("Error loading user data:", error);
              setLoading(false);
            }
          }, 0);
        } else {
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
      if (error) {
        console.error("Error getting session:", error);
        setLoading(false);
        return;
      }

      if (!isSubscribed) return;
      
      setSession(currentSession);
      
      // Fetch profile if we have a user
      if (currentSession?.user) {
        // Convert Supabase user to our User type
        const userObj: User = {
          id: currentSession.user.id,
          email: currentSession.user.email || undefined
        };
        setUser(userObj);
        
        // Using setTimeout to avoid potential recursive RLS issues
        setTimeout(async () => {
          if (!isSubscribed) return;
          
          try {
            const profile = await fetchProfile(currentSession.user!.id);
            setProfile(profile);
            await updateAdminStatus(currentSession.user!.id);
          } catch (error) {
            console.error("Error loading user data:", error);
          } finally {
            setLoading(false);
          }
        }, 0);
      } else {
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setLoading(false);
      }
    }).catch(error => {
      console.error("Error in getSession:", error);
      setLoading(false);
    });

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      // Clean up auth state first
      cleanupAuthState();
      
      // Attempt global sign out
      await supabase.auth.signOut({ scope: 'global' });
      
      // Force page reload for a clean state
      window.location.href = '/auth';
    } catch (error) {
      console.error('Error signing out:', error);
      
      // If normal signout fails, clean up and force reload as fallback
      cleanupAuthState();
      window.location.href = '/auth';
    }
  };

  // Create a single auth value object
  const value = {
    user,
    session,
    profile,
    loading,
    isLoggedIn: !!user,
    isAdmin,
    isLoading: loading,
    signOut,
    checkIsAdmin
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
