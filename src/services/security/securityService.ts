
import { isPreviewMode } from '@/services/previewService';
import { cleanupAuthState, signOut } from '@/services/auth/authService';

/**
 * Perform a secure signout with proper cleanup
 */
export const secureSignOut = async (): Promise<void> => {
  try {
    // Skip in preview mode
    if (isPreviewMode()) {
      console.log('Preview mode detected, skipping secure sign out');
      window.location.href = '/auth';
      return;
    }
    
    // Clean up auth state
    cleanupAuthState();
    
    // Perform sign out
    await signOut();
    
    // Redirect to auth page
    window.location.href = '/auth';
  } catch (error) {
    console.error('Error during secure sign out:', error);
    
    // Force navigation to auth page as fallback
    window.location.href = '/auth';
  }
};

// Re-export isPreviewMode for easy access
export { isPreviewMode };
