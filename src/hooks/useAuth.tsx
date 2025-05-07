
import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, UserProfile, UserRole } from '@/types/user-types';
import { Session } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { cleanupAuthState, signOutSecurely } from '@/services/auth/authService';

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
  refreshSession: () => Promise<boolean>;
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
  refreshSession: async () => false,
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
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
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
  }, [profileFetchAttempts]);

  // Check if user is an admin - using the fixed secure function
  const checkIsAdmin = useCallback(async (userId: string): Promise<boolean> => {
    try {
      if (!userId) return false;
      
      console.log('Checking admin status for user:', userId);
      
      const { data: isAdminSecure, error: secureError } = await supabase
        .rpc('is_admin_secure_fixed', { _user_id: userId });
      
      if (secureError) {
        console.error('Error checking admin status:', secureError);
        return false;
      }

      console.log('Admin check result:', isAdminSecure);
      return !!isAdminSecure;
    } catch (error) {
      console.error('Error in checkIsAdmin:', error);
      return false;
    }
  }, []);

  // Update admin status
  const updateAdminStatus = useCallback(async (userId: string) => {
    if (!userId) return;
    try {
      const isAdminUser = await checkIsAdmin(userId);
      setIsAdmin(isAdminUser);
    } catch (error) {
      console.error('Error updating admin status:', error);
      setIsAdmin(false);
    }
  }, [checkIsAdmin]);

  // Refresh the session - useful for recovering from error states
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      console.log('Manually refreshing session...');
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Error refreshing session:', error);
        return false;
      }
      
      if (data.session) {
        console.log('Session refreshed successfully');
        setSession(data.session);
        setUser({
          id: data.session.user.id,
          email: data.session.user.email || undefined
        });
        
        // Fetch profile in background
        setTimeout(async () => {
          const profile = await fetchProfile(data.session.user.id);
          setProfile(profile);
          await updateAdminStatus(data.session.user.id);
        }, 100);
        
        return true;
      }
      
      console.log('No session after refresh');
      return false;
    } catch (error) {
      console.error('Exception refreshing session:', error);
      return false;
    }
  }, [fetchProfile, updateAdminStatus]);

  useEffect(() => {
    let isSubscribed = true;
    
    const initialize = async () => {
      try {
        console.log('Initializing auth state...');
        
        // Set up auth state listener FIRST to avoid missing events
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (_event, newSession) => {
            if (!isSubscribed) return;
            
            console.log('Auth state changed:', _event);
            setSession(newSession);
            
            // Convert Supabase user to our User type
            if (newSession?.user) {
              const userObj: User = {
                id: newSession.user.id,
                email: newSession.user.email || undefined
              };
              setUser(userObj);
              
              // Defer profile fetching to avoid recursive RLS issues
              setTimeout(async () => {
                if (!isSubscribed) return;
                
                try {
                  const profile = await fetchProfile(newSession.user.id);
                  if (isSubscribed) {
                    setProfile(profile);
                    await updateAdminStatus(newSession.user.id);
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
        const { data: { session: existingSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error getting session:', sessionError);
          setLoading(false);
          return;
        }
        
        // Fetch profile if we have a user
        if (existingSession?.user) {
          // Convert Supabase user to our User type
          const userObj: User = {
            id: existingSession.user.id,
            email: existingSession.user.email || undefined
          };
          setUser(userObj);
          setSession(existingSession);
          
          // Defer profile fetching
          setTimeout(async () => {
            if (!isSubscribed) return;
            
            try {
              const profile = await fetchProfile(existingSession.user.id);
              if (isSubscribed) {
                setProfile(profile);
                await updateAdminStatus(existingSession.user.id);
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
        
        // Clean up subscription when component unmounts
        return () => {
          isSubscribed = false;
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Error initializing auth:', error);
        setLoading(false);
      }
    };
    
    initialize();
    
    return () => {
      isSubscribed = false;
    };
  }, [fetchProfile, updateAdminStatus]);

  const signOut = async () => {
    try {
      console.log('Signing out user...');
      await signOutSecurely();
    } catch (error) {
      console.error('Error in signOut:', error);
      toast.error('Sign out failed. Please try again.');
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
    checkIsAdmin,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
