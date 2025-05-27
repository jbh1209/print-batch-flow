
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types/user-types';
import { Session } from '@supabase/supabase-js';
import { AuthContext } from './AuthContext';
import { AuthState } from './types';
import { loadUserData, checkIsAdmin } from './authUtils';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    isAdmin: false
  });

  // Update user data when user changes
  const updateUserData = async (userId: string) => {
    const { profile, isAdmin } = await loadUserData(userId);
    setAuthState(prev => ({
      ...prev,
      profile,
      isAdmin
    }));
  };

  useEffect(() => {
    console.log('Setting up auth state listener...');
    
    let mounted = true;
    
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.error('Error getting initial session:', error);
          setAuthState(prev => ({ ...prev, loading: false }));
          return;
        }

        console.log('Initial session check:', !!session?.user);
        
        if (session?.user) {
          const userObj: User = {
            id: session.user.id,
            email: session.user.email || undefined
          };
          
          setAuthState(prev => ({
            ...prev,
            user: userObj,
            session
          }));
          
          // Load additional user data
          await updateUserData(session.user.id);
        }
        
        setAuthState(prev => ({ ...prev, loading: false }));
      } catch (error) {
        console.error('Error in getInitialSession:', error);
        if (mounted) {
          setAuthState(prev => ({ ...prev, loading: false }));
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log('Auth state changed:', event, session?.user?.id);
        
        if (session?.user) {
          const userObj: User = {
            id: session.user.id,
            email: session.user.email || undefined
          };
          
          setAuthState(prev => ({
            ...prev,
            user: userObj,
            session,
            loading: false
          }));
          
          // Load user data
          await updateUserData(session.user.id);
        } else {
          setAuthState({
            user: null,
            session: null,
            profile: null,
            loading: false,
            isAdmin: false
          });
        }
      }
    );

    // Get initial session
    getInitialSession();

    // Failsafe timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (mounted) {
        console.log('Auth timeout reached, forcing loading to false');
        setAuthState(prev => ({ ...prev, loading: false }));
      }
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true }));
      await supabase.auth.signOut();
      setAuthState({
        user: null,
        session: null,
        profile: null,
        loading: false,
        isAdmin: false
      });
    } catch (error) {
      console.error('Error signing out:', error);
      setAuthState(prev => ({ ...prev, loading: false }));
    }
  };

  return (
    <AuthContext.Provider value={{
      user: authState.user,
      session: authState.session,
      profile: authState.profile,
      loading: authState.loading,
      isLoggedIn: !!authState.user,
      isAdmin: authState.isAdmin,
      isLoading: authState.loading,
      signOut,
      checkIsAdmin
    }}>
      {children}
    </AuthContext.Provider>
  );
};
