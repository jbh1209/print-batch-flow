
/**
 * Session Management Core Utilities
 * 
 * Provides secure methods for managing authentication sessions,
 * preventing auth limbo states, and handling sign-out operations.
 */
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Clean up authentication state for secure sign out
 * Prevents authentication "limbo" states
 */
export const cleanupAuthState = () => {
  console.log('Cleaning up auth state');
  
  try {
    // Remove standard auth tokens
    localStorage.removeItem('supabase.auth.token');
    
    // Remove all Supabase auth keys from localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        console.log(`Removing auth key from localStorage: ${key}`);
        localStorage.removeItem(key);
      }
    });
    
    // Remove from sessionStorage if in use
    if (typeof sessionStorage !== 'undefined') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          console.log(`Removing auth key from sessionStorage: ${key}`);
          sessionStorage.removeItem(key);
        }
      });
    }
    
    console.log('Auth state cleanup completed');
  } catch (error) {
    console.error('Error during auth state cleanup:', error);
  }
};

/**
 * Secure sign out with thorough cleanup to prevent auth limbo states
 */
export async function secureSignOut(): Promise<void> {
  try {
    console.log("Starting secure sign out process");
    
    // Clean up auth state first before attempting sign-out
    cleanupAuthState();
    
    try {
      // Attempt global sign out
      await supabase.auth.signOut({ scope: 'global' });
      console.log("Supabase global sign-out successful");
    } catch (signOutError) {
      console.error("Error during Supabase sign out:", signOutError);
      // Continue with the process even if sign-out fails
    }
    
    // Add an optional toast notification for feedback
    if (typeof toast !== 'undefined') {
      toast.success("Successfully signed out");
    }
    
    // Force page reload for a clean state
    setTimeout(() => {
      window.location.href = '/auth';
    }, 300);
  } catch (error) {
    console.error("Critical error during secure sign out:", error);
    toast.error("Sign out encountered an error");
    
    // Force redirect to auth page as last resort
    setTimeout(() => {
      window.location.href = '/auth';
    }, 500);
  }
}
