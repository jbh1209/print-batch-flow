
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

  // Simplified profile fetch without RLS issues
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

  // Simplified admin check using the safe function
  const checkIsAdmin = async (userId: string): Promise<boolean> => {
    try {
      if (!userId) return false;
      
      const { data, error } = await supabase
        .rpc('get_user_role_safe', { user_id_param: userId });
      
      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }

      return data === 'admin';
    } catch (error) {
      console.error('Error in checkIsAdmin:', error);
      return false;
    }
  };

  // Update admin status safely
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
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isSubscribed) return;
        
        console.log('Auth state changed:', event, session?.user?.id);
        setSession(session);
        
        if (session?.user) {
          const userObj: User = {
            id: session.user.id,
            email: session.user.email || undefined
          };
          setUser(userObj);
          
          // Defer profile and admin fetching to avoid recursion
          setTimeout(async () => {
            if (!isSubscribed) return;
            
            try {
              const profile = await fetchProfile(session.user.id);
              setProfile(profile);
              await updateAdminStatus(session.user.id);
            } catch (error) {
              console.error('Error in deferred auth setup:', error);
            }
            setLoading(false);
          }, 100);
        } else {
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isSubscribed) return;
      
      setSession(session);
      
      if (session?.user) {
        const userObj: User = {
          id: session.user.id,
          email: session.user.email || undefined
        };
        setUser(userObj);
        
        try {
          const profile = await fetchProfile(session.user.id);
          setProfile(profile);
          await updateAdminStatus(session.user.id);
        } catch (error) {
          console.error('Error in initial auth setup:', error);
        }
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
