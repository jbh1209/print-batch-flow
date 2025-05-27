
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { AuthContext } from './AuthContext';
import { AuthState } from './types';
import { loadUserData } from './authUtils';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    isAdmin: false
  });

  // Simple user data loading
  const updateUserData = useCallback(async (userId: string) => {
    try {
      const { profile, isAdmin } = await loadUserData(userId);
      setAuthState(prev => ({
        ...prev,
        profile,
        isAdmin
      }));
    } catch (error) {
      console.warn('Failed to load user data:', error);
    }
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState(prev => ({
        ...prev,
        user: session?.user || null,
        session,
        loading: false
      }));

      if (session?.user) {
        updateUserData(session.user.id);
      }
    });

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setAuthState(prev => ({
          ...prev,
          user: session?.user || null,
          session,
          loading: false
        }));

        if (session?.user && event === 'SIGNED_IN') {
          updateUserData(session.user.id);
        } else if (!session) {
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

    return () => subscription.unsubscribe();
  }, [updateUserData]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, []);

  const checkIsAdmin = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { data } = await supabase.rpc('check_user_admin_status', { 
        check_user_id: userId 
      });
      return !!data;
    } catch (error) {
      console.warn('Admin check failed:', error);
      return false;
    }
  }, []);

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
