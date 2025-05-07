
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// Create a type for our Auth Context
export type AuthContextType = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  profile?: { full_name?: string | null; avatar_url?: string | null } | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
};

// Create the Auth Context with default values
export const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isLoading: true,
  isAdmin: false,
  profile: null,
  signIn: async () => {},
  signOut: async () => {},
  refreshSession: async () => false,
});

// Clean up auth state in storage
const cleanupAuthState = () => {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      localStorage.removeItem(key);
    }
  });
  
  if (typeof sessionStorage !== 'undefined') {
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        sessionStorage.removeItem(key);
      }
    });
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<{ full_name?: string | null; avatar_url?: string | null } | null>(null);
  const navigate = useNavigate();

  // Check if a user is an admin
  const checkIsAdmin = async (userId: string): Promise<boolean> => {
    if (!userId) return false;
    
    try {
      const { data, error } = await supabase
        .rpc('is_admin_secure_fixed', { _user_id: userId });
      
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

  // Fetch user profile data
  const fetchUserProfile = async (userId: string) => {
    try {
      // Try to get the profile
      let { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }
      
      // If profile doesn't exist, create it
      if (!data) {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({ id: userId })
          .select('full_name, avatar_url')
          .single();
        
        if (insertError) {
          console.error('Error creating profile:', insertError);
          return null;
        }
        
        // After creating, fetch again
        const { data: newData, error: fetchError } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', userId)
          .maybeSingle();
          
        if (fetchError) {
          console.error('Error fetching new profile:', fetchError);
          return null;
        }
        
        data = newData;
      }
      
      setProfile(data);
      return data;
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      return null;
    }
  };

  // Update admin status whenever user changes
  useEffect(() => {
    const updateAdminStatus = async () => {
      if (user?.id) {
        const isUserAdmin = await checkIsAdmin(user.id);
        setIsAdmin(isUserAdmin);
        
        // Also fetch profile data
        await fetchUserProfile(user.id);
      } else {
        setIsAdmin(false);
        setProfile(null);
      }
    };

    updateAdminStatus();
  }, [user]);

  // Initialize auth state and listen for changes
  useEffect(() => {
    let mounted = true;
    
    const setupAuth = async () => {
      try {
        // Set up auth change listener FIRST to avoid missing events
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, currentSession) => {
            if (!mounted) return;
            
            console.log('Auth state changed:', event);
            
            // Only update state with synchronous operations
            setSession(currentSession);
            setUser(currentSession?.user || null);
            
            // Use setTimeout to avoid recursive state updates
            if (currentSession?.user) {
              setTimeout(() => {
                if (mounted) {
                  checkIsAdmin(currentSession.user!.id)
                    .then(isAdmin => setIsAdmin(isAdmin))
                    .catch(err => console.error("Admin check error:", err));
                    
                  fetchUserProfile(currentSession.user!.id)
                    .catch(err => console.error("Profile fetch error:", err));
                }
              }, 0);
            }
          }
        );
        
        // Then check for existing session
        const { data } = await supabase.auth.getSession();
        if (mounted) {
          setSession(data.session);
          setUser(data.session?.user || null);
          
          if (data.session?.user) {
            const isUserAdmin = await checkIsAdmin(data.session.user.id);
            setIsAdmin(isUserAdmin);
            await fetchUserProfile(data.session.user.id);
          }
        }
        
        setIsLoading(false);
        
        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    
    setupAuth();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Sign in function with proper error handling
  const signIn = async (email: string, password: string) => {
    try {
      // Clean up any existing auth state to prevent conflicts
      cleanupAuthState();
      
      // Attempt to sign out first to clear any existing sessions
      try {
        await supabase.auth.signOut();
      } catch (err) {
        // Continue despite error
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      toast.success('Signed in successfully');
      navigate('/');
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast.error(error.message || 'Failed to sign in');
      throw error;
    }
  };

  // Sign out function with thorough cleanup
  const signOut = async () => {
    try {
      // Clean up auth state first
      cleanupAuthState();
      
      // Attempt global sign out
      await supabase.auth.signOut({ scope: 'global' });
      
      // Clear state
      setSession(null);
      setUser(null);
      setIsAdmin(false);
      setProfile(null);
      
      toast.success('Signed out successfully');
      navigate('/auth');
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast.error(error.message || 'Failed to sign out');
      
      // Force clean up on error
      cleanupAuthState();
      window.location.href = '/auth';
    }
  };
  
  // Refresh session manually - useful for recovering from errors
  const refreshSession = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Session refresh error:', error);
        return false;
      }
      
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        
        // Update admin status in background
        const isUserAdmin = await checkIsAdmin(data.session.user.id);
        setIsAdmin(isUserAdmin);
        await fetchUserProfile(data.session.user.id);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Session refresh exception:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isLoading,
        isAdmin,
        profile,
        signIn,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the Auth Context
export const useAuth = () => useContext(AuthContext);
