
import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, UserProfile, UserRole } from '@/types/user-types';
import { Session } from '@supabase/supabase-js';

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

  // Simple profile fetch with better error handling
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Profile fetch failed (non-critical):', error.message);
        return null;
      }
      
      return data;
    } catch (error) {
      console.warn('Profile fetch error (non-critical):', error);
      return null;
    }
  };

  // Use the new secure admin check function
  const checkIsAdmin = async (userId: string): Promise<boolean> => {
    try {
      if (!userId) return false;
      
      const { data, error } = await supabase.rpc('check_user_admin_status', { 
        check_user_id: userId 
      });
      
      if (error) {
        console.warn('Admin check failed (non-critical):', error.message);
        return false;
      }

      return !!data;
    } catch (error) {
      console.warn('Admin check error (non-critical):', error);
      return false;
    }
  };

  // Load user data with proper error boundaries
  const loadUserData = async (userId: string) => {
    try {
      const [profileData, adminStatus] = await Promise.allSettled([
        fetchProfile(userId),
        checkIsAdmin(userId)
      ]);
      
      if (profileData.status === 'fulfilled') {
        setProfile(profileData.value);
      }
      
      if (adminStatus.status === 'fulfilled') {
        setIsAdmin(adminStatus.value);
      }
    } catch (error) {
      console.warn('User data loading failed (non-critical):', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('Setting up auth state listener...');
    
    // Clean auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        setSession(session);
        
        if (session?.user) {
          const userObj: User = {
            id: session.user.id,
            email: session.user.email || undefined
          };
          setUser(userObj);
          
          // Defer user data loading to prevent auth conflicts
          setTimeout(() => {
            loadUserData(session.user.id);
          }, 100);
        } else {
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          setLoading(false);
        }
      }
    );

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', !!session?.user);
      if (!session) {
        setLoading(false);
      }
    }).catch(() => {
      setLoading(false);
    });

    // Failsafe timeout
    const timeout = setTimeout(() => {
      console.log('Auth timeout reached');
      setLoading(false);
    }, 3000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsAdmin(false);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  return <AuthContext.Provider value={{
    user,
    session,
    profile,
    loading,
    isLoggedIn: !!user,
    isAdmin,
    isLoading: loading,
    signOut,
    checkIsAdmin
  }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
