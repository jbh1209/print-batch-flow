
import { supabase } from '@/integrations/supabase/client';

/**
 * Helper service for authentication-related functions
 */

// Clean up all auth state in localStorage and sessionStorage
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

// Robust sign out function that handles edge cases
export const signOutSecurely = async (): Promise<void> => {
  try {
    // Clean up auth state first
    cleanupAuthState();
    
    // Attempt to sign out
    await supabase.auth.signOut({ scope: 'global' });
    
    // Force page reload for a clean state
    setTimeout(() => {
      window.location.href = '/auth';
    }, 500);
  } catch (error) {
    console.error('Failed to sign out:', error);
    
    // Force clean up as last resort
    cleanupAuthState();
    window.location.reload();
    
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
    'not logged in', 'Authentication', 'authentication'
  ];
  
  return authErrorPatterns.some(pattern => 
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
};

// Handle auth error with appropriate action
export const handleAuthError = async (error: any): Promise<void> => {
  if (isAuthError(error)) {
    console.log('Authentication error detected, signing out...');
    await signOutSecurely();
  }
};
