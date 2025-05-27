
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
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

  const mountedRef = useRef(true);
  const initializedRef = useRef(false);

  // Optimized user data update with ref checks
  const updateUserData = useCallback(async (userId: string) => {
    if (!mountedRef.current || !userId) return;
    
    try {
      const { profile, isAdmin } = await loadUserData(userId);
      
      if (!mountedRef.current) return;
      
      setAuthState(prev => ({
        ...prev,
        profile,
        isAdmin
      }));
    } catch (error) {
      console.warn('User data loading failed (non-critical):', error);
    }
  }, []);

  useEffect(() => {
    console.log('Setting up auth state listener...');
    
    // Get initial session without causing loops
    const initializeAuth = async () => {
      if (initializedRef.current) return;
      initializedRef.current = true;
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mountedRef.current) return;
        
        if (error) {
          console.error('Error getting initial session:', error);
          setAuthState(prev => ({ ...prev, loading: false }));
          return;
        }

        console.log('Initial session check:', !!session?.user);
        
        if (session?.user) {
          setAuthState(prev => ({
            ...prev,
            user: session.user,
            session,
            loading: false
          }));
          
          // Load additional user data asynchronously
          updateUserData(session.user.id);
        } else {
          setAuthState(prev => ({ ...prev, loading: false }));
        }
      } catch (error) {
        console.error('Error in initializeAuth:', error);
        if (mountedRef.current) {
          setAuthState(prev => ({ ...prev, loading: false }));
        }
      }
    };

    // Set up auth state listener with optimized handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return;
        
        console.log('Auth state changed:', event, session?.user?.id);
        
        if (session?.user) {
          setAuthState(prev => ({
            ...prev,
            user: session.user,
            session,
            loading: false
          }));
          
          // Only load user data on sign in, not on token refresh
          if (event === 'SIGNED_IN') {
            // Defer to prevent blocking
            setTimeout(() => {
              updateUserData(session.user.id);
            }, 0);
          }
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

    // Initialize auth after setting up listener
    initializeAuth();

    // Cleanup timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (mountedRef.current && !initializedRef.current) {
        console.log('Auth timeout reached, forcing loading to false');
        setAuthState(prev => ({ ...prev, loading: false }));
      }
    }, 3000); // Reduced from 5 seconds

    return () => {
      mountedRef.current = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array to prevent loops

  const signOut = useCallback(async () => {
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
