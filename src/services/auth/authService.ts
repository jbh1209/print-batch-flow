
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Helper service for authentication-related functions
 */

// Clean up all auth state in localStorage and sessionStorage
export const cleanupAuthState = () => {
  try {
    console.log('Cleaning up auth state...');
    
    // Remove all Supabase auth keys from localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        console.log(`Removing localStorage key: ${key}`);
        localStorage.removeItem(key);
      }
    });
    
    // Clean sessionStorage if used
    if (typeof sessionStorage !== 'undefined') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          console.log(`Removing sessionStorage key: ${key}`);
          sessionStorage.removeItem(key);
        }
      });
    }
    
    console.log('Auth state cleanup complete');
  } catch (error) {
    console.error('Error cleaning up auth state:', error);
  }
};

// Robust sign out function that handles edge cases
export const signOutSecurely = async (): Promise<void> => {
  try {
    console.log('Starting secure sign out process...');
    
    // Attempt to sign out with global scope to invalidate all sessions
    try {
      console.log('Calling supabase.auth.signOut with global scope...');
      await supabase.auth.signOut({ scope: 'global' });
      console.log('Global sign out successful');
    } catch (error) {
      console.error('Failed to sign out globally:', error);
      // Continue despite error
    }
    
    // Clean up auth state after sign out
    cleanupAuthState();
    
    // Use navigation instead of force reload
    console.log('Redirecting to auth page...');
    window.location.href = '/auth';
  } catch (error) {
    console.error('Failed to sign out:', error);
    
    // Force clean up as last resort
    cleanupAuthState();
    
    // Still try to redirect user even if sign out failed
    window.location.href = '/auth';
    
    throw error; // Re-throw for callers to handle
  }
};

// Check if auth error requires sign out
export const isAuthError = (error: any): boolean => {
  if (!error) return false;
  
  const errorMessage = typeof error === 'string' 
    ? error 
    : error.message || error.error_description || '';
  
  const authErrorPatterns = [
    'jwt', 'JWT', 'token',
    'session expired', 'not authenticated',
    'not logged in', 'Authentication', 'authentication',
    '401', 'unauthorized', 'Unauthorized'
  ];
  
  const isAuthIssue = authErrorPatterns.some(pattern => 
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
  
  if (isAuthIssue) {
    console.log(`Auth error detected: "${errorMessage}"`);
  }
  
  return isAuthIssue;
};

// Handle auth error with appropriate action
export const handleAuthError = async (error: any): Promise<void> => {
  if (isAuthError(error)) {
    console.log('Authentication error detected, signing out...');
    await signOutSecurely();
  } else {
    console.log('Non-auth error, no sign out needed');
  }
};

// Get a fresh JWT token before making an API request
export const getFreshAuthToken = async (): Promise<string | null> => {
  try {
    console.log('Getting fresh auth token...');
    
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
    
    console.log('Using existing valid token');
    return token;
  } catch (error) {
    console.error('Error in getFreshAuthToken:', error);
    return null;
  }
};
