
/**
 * Auth Verification Core Utilities
 * 
 * Provides secure methods for verifying user roles and permissions
 * with fallback strategies for general authentication.
 */
import { supabase } from '@/integrations/supabase/client';
import { isPreviewMode } from '@/services/previewService';

/**
 * Verify user has a specific role - simplified to always allow 'user' role
 */
export async function verifyUserRole(userId: string, role: 'user', userEmail?: string | null): Promise<boolean> {
  if (!userId) return false;
  
  // Auto-approve in preview mode for testing
  if (isPreviewMode()) {
    console.log(`Preview mode detected, auto-approving role '${role}' verification`);
    return true;
  }
  
  try {
    // In production, we now only support the 'user' role
    if (role === 'user') {
      return true; // Authenticated users always have the 'user' role
    }
    
    // All other roles are not supported
    return false;
  } catch (error) {
    console.error(`Error verifying role '${role}':`, error);
    return false;
  }
}
