
import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, UserProfile, UserRole } from '@/types/user-types';
import { Session } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { cleanupAuthState } from '@/services/auth/authService';

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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileFetchAttempts, setProfileFetchAttempts] = useState(0);
  const MAX_PROFILE_FETCH_ATTEMPTS = 3;

  // Fetch user profile from profiles table with retry logic
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    if (!userId) return null;
    
    try {
      console.log('Attempting to fetch profile for user:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        
        // Track failed attempts
        setProfileFetchAttempts(prev => prev + 1);
        
        // If we haven't reached max attempts, retry with exponential backoff
        if (profileFetchAttempts < MAX_PROFILE_FETCH_ATTEMPTS) {
          const backoffTime = Math.pow(2, profileFetchAttempts) * 500; // Exponential backoff
          console.log(`Will retry profile fetch in ${backoffTime}ms`);
          
          // Retry after delay
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          return fetchProfile(userId);
        }
        
        // Return null if we've exceeded max retry attempts
        return null;
      }
      
      // Reset attempts counter on success
      setProfileFetchAttempts(0);
      console.log('Profile fetched successfully:', data);
      return data;
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      return null;
    }
  };

  // Check if user is an admin - using the fixed secure function
  const checkIsAdmin = async (userId: string): Promise<boolean> => {
    try {
      if (!userId) return false;
      
      const { data: isAdminSecure, error: secureError } = await supabase
        .rpc('is_admin_secure_fixed', { _user_id: userId });
      
      if (secureError) {
        console.error('Error checking admin status:', secureError);
        return false;
      }

      return !!isAdminSecure;
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
      async (_event, session) => {
        if (!isSubscribed) return;
        
        setSession(session);
        
        // Convert Supabase user to our User type
        if (session?.user) {
          const userObj: User = {
            id: session.user.id,
            email: session.user.email || undefined
          };
          setUser(userObj);
          
          // Defer profile fetching to avoid recursive RLS issues
          setTimeout(async () => {
            if (!isSubscribed) return;
            
            try {
              const profile = await fetchProfile(session.user.id);
              if (isSubscribed) {
                setProfile(profile);
                await updateAdminStatus(session.user.id);
              }
            } finally {
              if (isSubscribed) {
                setLoading(false);
              }
            }
          }, 100);
        } else {
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isSubscribed) return;
      
      setSession(session);
      
      // Fetch profile if we have a user
      if (session?.user) {
        // Convert Supabase user to our User type
        const userObj: User = {
          id: session.user.id,
          email: session.user.email || undefined
        };
        setUser(userObj);
        
        // Defer profile fetching
        setTimeout(async () => {
          if (!isSubscribed) return;
          
          try {
            const profile = await fetchProfile(session.user.id);
            if (isSubscribed) {
              setProfile(profile);
              await updateAdminStatus(session.user.id);
            }
          } finally {
            if (isSubscribed) {
              setLoading(false);
            }
          }
        }, 100);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      // First clean up all auth state to prevent issues
      cleanupAuthState();
      
      // Then attempt sign out
      await supabase.auth.signOut({ scope: 'global' });
      
      // Clear state
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsAdmin(false);
      
      // Force page reload to ensure a clean state
      setTimeout(() => {
        window.location.href = '/auth';
      }, 500);
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Sign out failed. Please try again.');
      
      // Force reload as last resort
      setTimeout(() => {
        window.location.reload();
      }, 1000);
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
