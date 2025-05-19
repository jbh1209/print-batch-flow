
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
      
      // Try secure function first
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
      
      // Fall back to standard function using RPC functions that exist
      const { data, error } = await supabase
        .rpc('any_admin_exists');
      
      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }

      return !!data;
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
          
          // Fetch profile if we have a user - use setTimeout to avoid recursive RLS issues
          setTimeout(async () => {
            if (!isSubscribed) return;
            
            const profile = await fetchProfile(session.user.id);
            setProfile(profile);
            await updateAdminStatus(session.user.id);
            setLoading(false);
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
        
        const profile = await fetchProfile(session.user.id);
        setProfile(profile);
        await updateAdminStatus(session.user.id);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
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
