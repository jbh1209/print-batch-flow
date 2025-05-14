
/**
 * Security Service
 * 
 * IMPORTANT: This file uses explicit dynamic imports to prevent circular dependencies
 * and unintended data fetching during module initialization.
 */
import { isPreviewMode } from '@/services/core/previewService';

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
    
    // Dynamically import auth service to prevent circular dependencies
    const authService = await import('@/services/auth/authService');
    
    // Clean up auth state
    authService.cleanupAuthState();
    
    // Perform sign out
    await authService.signOut();
    
    // Redirect to auth page
    window.location.href = '/auth';
  } catch (error) {
    console.error('Error during secure sign out:', error);
    
    // Force navigation to auth page as fallback
    window.location.href = '/auth';
  }
};

// Re-export isPreviewMode for easy access
export { isPreviewMode } from '@/services/core/previewService';

// Dynamically export cleanupAuthState to avoid circular dependencies
export const cleanupAuthState = async (): Promise<void> => {
  try {
    const authService = await import('@/services/auth/authService');
    authService.cleanupAuthState();
  } catch (error) {
    console.error('Error importing cleanupAuthState:', error);
  }
};
