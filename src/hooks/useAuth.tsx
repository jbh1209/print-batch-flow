
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

  // Simplified profile fetch
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

  // Simplified admin check
  const checkIsAdmin = async (userId: string): Promise<boolean> => {
    try {
      if (!userId) return false;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
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

  useEffect(() => {
    console.log('Setting up auth state listener...');
    
    // Simple auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        setSession(session);
        
        if (session?.user) {
          const userObj: User = {
            id: session.user.id,
            email: session.user.email || undefined
          };
          setUser(userObj);
          
          // Load additional data in background
          Promise.all([
            fetchProfile(session.user.id),
            checkIsAdmin(session.user.id)
          ]).then(([profile, isAdminUser]) => {
            setProfile(profile);
            setIsAdmin(isAdminUser);
            setLoading(false);
          }).catch(() => {
            setLoading(false);
          });
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
      setLoading(false);
    } catch (error) {
      console.error('Error signing out:', error);
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
