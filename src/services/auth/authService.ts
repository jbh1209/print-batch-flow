
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

/**
 * Clean up auth state to prevent auth limbo states
 */
export const cleanupAuthState = (): void => {
  try {
    console.log('Cleaning up auth state');
    
    // Remove standard auth tokens
    localStorage.removeItem('supabase.auth.token');
    
    // Remove all Supabase auth keys
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
    
    // Clean sessionStorage if used
    if (typeof sessionStorage !== 'undefined') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.error('Error cleaning up auth state:', error);
  }
};

/**
 * Sign in with email and password
 */
export const signIn = async (email: string, password: string): Promise<{ user: User | null; session: Session | null; error: Error | null }> => {
  try {
    // Clean up existing auth state first
    cleanupAuthState();
    
    // Attempt to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      return { user: null, session: null, error };
    }
    
    return { 
      user: data.user, 
      session: data.session,
      error: null 
    };
  } catch (error: any) {
    return { 
      user: null, 
      session: null,
      error
    };
  }
};

/**
 * Sign up with email and password
 */
export const signUp = async (
  email: string, 
  password: string, 
  userData?: { full_name?: string }
): Promise<{ user: User | null; session: Session | null; error: Error | null }> => {
  try {
    // Clean up existing auth state first
    cleanupAuthState();
    
    // Attempt to sign up
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    });
    
    if (error) {
      return { user: null, session: null, error };
    }
    
    return { 
      user: data.user, 
      session: data.session,
      error: null 
    };
  } catch (error: any) {
    return { 
      user: null, 
      session: null,
      error
    };
  }
};

/**
 * Sign out user
 */
export const signOut = async (): Promise<{ error: Error | null }> => {
  try {
    // Clean up auth state first
    cleanupAuthState();
    
    // Attempt global sign out
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    
    if (error) {
      return { error };
    }
    
    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

/**
 * Get current session
 */
export const getSession = async (): Promise<{ session: Session | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      return { session: null, error };
    }
    
    return { session: data.session, error: null };
  } catch (error: any) {
    return { session: null, error };
  }
};

/**
 * Refresh session
 */
export const refreshSession = async (): Promise<{ session: Session | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      return { session: null, error };
    }
    
    return { session: data.session, error: null };
  } catch (error: any) {
    return { session: null, error };
  }
};
