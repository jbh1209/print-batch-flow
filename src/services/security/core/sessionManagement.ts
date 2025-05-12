
/**
 * Session Management Core Utilities
 * 
 * Provides secure methods for managing authentication sessions,
 * preventing auth limbo states, and handling sign-out operations.
 */
import { supabase } from '@/integrations/supabase/client';

/**
 * Clean up authentication state for secure sign out
 * Prevents authentication "limbo" states
 */
export const cleanupAuthState = () => {
  // Remove standard auth tokens
  localStorage.removeItem('supabase.auth.token');
  
  // Remove all Supabase auth keys from localStorage
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      localStorage.removeItem(key);
    }
  });
  
  // Remove from sessionStorage if in use
  Object.keys(sessionStorage || {}).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      sessionStorage.removeItem(key);
    }
  });
};

/**
 * Secure sign out with thorough cleanup to prevent auth limbo states
 */
export async function secureSignOut(): Promise<void> {
  try {
    // Clean up auth state
    cleanupAuthState();
    
    // Attempt global sign out
    await supabase.auth.signOut({ scope: 'global' });
    
    // Force page reload for a clean state
    window.location.href = '/auth';
  } catch (error) {
    console.error("Error during secure sign out:", error);
    // Still redirect to auth page
    window.location.href = '/auth';
  }
}
