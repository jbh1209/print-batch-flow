
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Helper service for authentication-related functions
 */

// Clean up all auth state in localStorage and sessionStorage
export const cleanupAuthState = () => {
  try {
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

// Robust sign out function
export const signOutSecurely = async (): Promise<void> => {
  try {
    // Attempt to sign out with global scope to invalidate all sessions
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (error) {
      // Continue despite error
    }
    
    // Clean up auth state after sign out
    cleanupAuthState();
    
    // Use navigation to auth page
    window.location.href = '/auth';
  } catch (error) {
    console.error('Failed to sign out:', error);
    
    // Force clean up as last resort
    cleanupAuthState();
    
    // Still try to redirect user even if sign out failed
    window.location.href = '/auth';
    
    throw error;
  }
};

// Check if auth error requires sign out
export const isAuthError = (error: any): boolean => {
  if (!error) return false;
  
  const errorMessage = typeof error === 'string' 
    ? error 
    : error.message || error.error_description || '';
  
  return errorMessage.toLowerCase().includes('jwt') || 
    errorMessage.toLowerCase().includes('token') ||
    errorMessage.toLowerCase().includes('session') ||
    errorMessage.toLowerCase().includes('auth') ||
    errorMessage.toLowerCase().includes('401');
};

// Handle auth error with appropriate action
export const handleAuthError = async (error: any): Promise<void> => {
  if (isAuthError(error)) {
    await signOutSecurely();
  }
};

// Get a fresh JWT token before making an API request
export const getFreshAuthToken = async (): Promise<string | null> => {
  try {
    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      throw error;
    }
    
    if (!session) {
      console.warn('No session available');
      return null;
    }
    
    // Get the access token from the current session
    const token = session.access_token;
    
    // Check if token expires soon (within 5 minutes)
    const tokenExpiry = new Date((session.expires_at || 0) * 1000);
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    if (tokenExpiry.getTime() - now.getTime() < fiveMinutes) {
      console.log('Token expires soon, refreshing...');
      
      // Refresh the session
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('Error refreshing session:', refreshError);
        throw refreshError;
      }
      
      if (refreshData.session) {
        console.log('Token refreshed successfully');
        return refreshData.session.access_token;
      }
    }
    
    return token;
  } catch (error) {
    console.error('Error in getFreshAuthToken:', error);
    return null;
  }
};
