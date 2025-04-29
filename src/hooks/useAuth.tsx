
import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isLoggedIn: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  checkAdminStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  isLoggedIn: false,
  isAdmin: false,
  signOut: async () => {},
  refreshProfile: async () => {},
  updateProfile: async () => {},
  checkAdminStatus: async () => false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch user profile from profiles table
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      
      return data as Profile;
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      return null;
    }
  };
  
  // Update user profile
  const updateProfile = async (data: Partial<Profile>) => {
    if (!user) {
      toast.error("You must be logged in to update your profile");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', user.id);
        
      if (error) throw error;
      
      // Refresh profile data
      const updatedProfile = await fetchProfile(user.id);
      if (updatedProfile) {
        setProfile(updatedProfile);
        toast.success("Profile updated successfully");
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(`Failed to update profile: ${error.message}`);
    }
  };
  
  // Refresh user profile
  const refreshProfile = async () => {
    if (!user) return;
    
    try {
      const profile = await fetchProfile(user.id);
      setProfile(profile);
      await checkAdminStatus();
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  // Check if user is an admin using the is_admin RPC function
  const checkAdminStatus = async (): Promise<boolean> => {
    try {
      if (!user?.id) return false;
      
      const { data, error } = await supabase
        .rpc('is_admin', { _user_id: user.id });
      
      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }

      setIsAdmin(!!data);
      return !!data;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  };

  useEffect(() => {
    // Track mounted state to avoid state updates after unmount
    let isMounted = true;
    
    // Set up auth state listener FIRST to avoid missing events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        if (!isMounted) return;
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          // Use setTimeout to avoid potential recursive RLS issues
          setTimeout(async () => {
            if (!isMounted) return;
            
            try {
              const userProfile = await fetchProfile(currentSession.user.id);
              setProfile(userProfile);
              await checkAdminStatus();
              setLoading(false);
            } catch (error) {
              console.error("Failed to load user data:", error);
              setLoading(false);
            }
          }, 0);
        } else {
          setProfile(null);
          setIsAdmin(false);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!isMounted) return;
      
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        fetchProfile(currentSession.user.id).then(userProfile => {
          if (!isMounted) return;
          
          setProfile(userProfile);
          checkAdminStatus().then(() => {
            if (isMounted) setLoading(false);
          });
        });
      } else {
        setLoading(false);
      }
    });

    // Cleanup function
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast.error(`Error signing out: ${error.message}`);
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
    signOut,
    refreshProfile,
    updateProfile,
    checkAdminStatus
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
