
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { AuthContext } from './AuthContext';
import { AuthState } from './types';
import { loadUserData } from './authUtils';
import { cleanupAuthState } from '@/utils/authCleanup';

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
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, !!session);
        
        if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed successfully');
        }
        
        if (event === 'SIGNED_OUT' || !session) {
          console.log('User signed out or no session');
          setAuthState({
            user: null,
            session: null,
            profile: null,
            loading: false,
            isAdmin: false
          });
          return;
        }
        
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('User signed in:', session.user.id);
          setAuthState(prev => ({
            ...prev,
            user: session.user,
            session,
            loading: false
          }));
          
          // Defer user data loading with timeout to prevent auth deadlocks
          setTimeout(() => {
            updateUserData(session.user.id).catch(error => {
              console.warn('Failed to load user data during sign in:', error);
              // Don't block auth on user data failure
            });
          }, 100);
          return;
        }
        
        // Update state for any other events
        setAuthState(prev => ({
          ...prev,
          user: session?.user || null,
          session,
          loading: false
        }));
      }
    );

    // THEN check for existing session with timeout
    Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Session check timeout')), 10000)
      )
    ]).then(({ data: { session }, error }: any) => {
      if (error) {
        console.error('Session retrieval error:', error);
        // Clean up on session errors
        cleanupAuthState();
        setAuthState(prev => ({ ...prev, loading: false }));
        return;
      }
      
      console.log('Initial session check:', !!session);
      setAuthState(prev => ({
        ...prev,
        user: session?.user || null,
        session,
        loading: false
      }));

      if (session?.user) {
        updateUserData(session.user.id).catch(error => {
          console.warn('Failed to load user data during session check:', error);
          // Don't block auth on user data failure
        });
      }
    }).catch((error) => {
      console.error('Session check failed or timed out:', error);
      cleanupAuthState();
      setAuthState(prev => ({ ...prev, loading: false }));
    });

    return () => subscription.unsubscribe();
  }, [updateUserData]);

  const signOut = useCallback(async () => {
    try {
      console.log('Signing out...');
      // Clean up first
      cleanupAuthState();
      
      // Attempt global sign out
      await supabase.auth.signOut({ scope: 'global' });
      
      // Force page reload for clean state
      window.location.href = '/auth';
    } catch (error) {
      console.error('Error signing out:', error);
      // Force cleanup and redirect even on error
      cleanupAuthState();
      window.location.href = '/auth';
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
