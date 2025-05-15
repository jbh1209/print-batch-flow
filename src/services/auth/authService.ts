
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Session } from '@supabase/supabase-js';

/**
 * Clean up all auth state in localStorage and sessionStorage
 * This helps prevent auth limbo states
 */
export const cleanupAuthState = () => {
  try {
    // Remove standard auth tokens
    localStorage.removeItem('supabase.auth.token');
    
    // Remove all Supabase auth keys from localStorage
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
 * Sign out with proper cleanup
 */
export const signOut = async (): Promise<void> => {
  try {
    // Clean up auth state first
    cleanupAuthState();
    
    // Attempt global sign out
    await supabase.auth.signOut({ scope: 'global' });
    
    // Force page reload for a clean state
    window.location.href = '/auth';
  } catch (error) {
    console.error('Failed to sign out:', error);
    toast.error('Sign out failed. Please try again.');
    
    // Force reload as last resort
    setTimeout(() => window.location.reload(), 1000);
  }
};

/**
 * Sign in with proper error handling
 */
export const signIn = async (email: string, password: string): Promise<void> => {
  try {
    // Clean up existing state first
    cleanupAuthState();
    
    // Attempt to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    
    // Success - the auth listener will handle the redirect
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  }
};

/**
 * Sign up with proper error handling
 */
export const signUp = async (email: string, password: string, userData?: { full_name?: string }): Promise<void> => {
  try {
    // Clean up existing state first
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
    
    if (error) throw error;
    
    // Success - the auth listener will handle the rest
  } catch (error: any) {
    console.error('Sign up error:', error);
    throw error;
  }
};

/**
 * Get current session
 */
export const getSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
};

/**
 * Check if current user has admin role
 */
export const checkIsAdmin = async (userId: string): Promise<boolean> => {
  if (!userId) return false;
  
  try {
    try {
      // Try using the stored procedure first
      const { data, error } = await supabase.rpc('is_admin_secure_fixed', { _user_id: userId });
      
      if (error) {
        console.error('Error checking admin status with function:', error);
        throw error;
      }
      
      return !!data;
    } catch (functionError) {
      // Fallback to direct query if function fails
      console.warn('Falling back to direct query for admin check');
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (error) {
        console.error('Error checking admin with fallback:', error);
        return false;
      }
      
      return !!data;
    }
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

/**
 * Refresh the session token
 */
export const refreshToken = async (): Promise<Session | null> => {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
    
    return data.session;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
};
