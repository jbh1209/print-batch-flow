
/**
 * User Access Core Utilities
 * 
 * Provides secure methods for accessing current user data
 * with enhanced error handling and preview mode support.
 */
import { supabase } from '@/integrations/supabase/client';
import { isPreviewMode } from '@/services/previewService';
import { verifyUserRole } from './authVerification';

// Type for authenticated user details
export interface SecureCurrentUser {
  id: string;
  email: string;
  isAdmin: boolean;
  fullName: string | null;
  avatarUrl: string | null;
  lastSignInAt: string | null;
}

/**
 * Get secure current user with role information
 * Uses multiple strategies to ensure robust access
 * NOTE: This function is designed to be called explicitly, not automatically
 */
export async function getSecureCurrentUser(): Promise<SecureCurrentUser | null> {
  // In preview mode, return a consistent mock user
  if (isPreviewMode()) {
    console.log("Preview mode detected, returning mock admin user");
    return {
      id: 'preview-user-id',
      email: 'admin@example.com',
      isAdmin: true,
      fullName: 'Preview Admin',
      avatarUrl: null,
      lastSignInAt: new Date().toISOString()
    };
  }

  try {
    console.log("Getting secure current user - EXPLICIT CALL ONLY");
    
    // Get current session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("Session error in getSecureCurrentUser:", sessionError);
      return null;
    }
    
    if (!sessionData.session?.user) {
      console.log("No authenticated user found");
      return null;
    }
    
    const user = sessionData.session.user;
    
    // Get user profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    
    if (profileError) {
      console.warn("Error fetching profile:", profileError);
      // Continue without profile data
    }
    
    // Check admin status with all fallback strategies
    const isAdmin = await verifyUserRole(user.id, 'admin', user.email);
    
    return {
      id: user.id,
      email: user.email || '',
      isAdmin,
      fullName: profileData?.full_name || null,
      avatarUrl: profileData?.avatar_url || null,
      lastSignInAt: user.last_sign_in_at || null
    };
  } catch (error) {
    console.error("Error in getSecureCurrentUser:", error);
    return null;
  }
}
