/**
 * User Access Core Utilities
 * 
 * Provides secure methods for retrieving and working with 
 * authenticated user data with improved error handling and preview mode support.
 */
import { supabase } from '@/integrations/supabase/client';
import { UserWithRole, validateUserRole } from '@/types/user-types';
import { isPreviewMode, getPreviewMockData } from '@/services/previewService';
import { verifyUserRole } from './authVerification';

/**
 * Get current user with enhanced security checks and proper type handling
 * Includes multi-layered fallbacks and preview mode support
 * 
 * @returns Promise resolving to the current authenticated user or null
 */
export async function getSecureCurrentUser(): Promise<UserWithRole | null> {
  // For preview mode, return a consistent mock user
  if (isPreviewMode()) {
    console.log("Preview mode detected in getSecureCurrentUser, using mock user");
    return getPreviewMockData('admin') as UserWithRole;
  }

  try {
    // Get current session with improved error handling
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("Session error in getSecureCurrentUser:", sessionError);
      return null;
    }
    
    if (!sessionData.session) {
      console.log("No valid session found in getSecureCurrentUser");
      
      // Try to refresh session once before giving up
      try {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshData.session) {
          console.log("Session refresh failed:", refreshError);
          return null;
        }
        
        console.log("Session refreshed successfully");
        // Continue with the refreshed session data
        sessionData.session = refreshData.session;
      } catch (refreshError) {
        console.error("Error refreshing session:", refreshError);
        return null;
      }
    }
    
    const { user } = sessionData.session;
    if (!user) {
      console.warn("Session exists but no user object found");
      return null;
    }
    
    // First get the basic user profile with retry logic
    let profile = null;
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      
      if (profileError) {
        console.warn("Error fetching profile:", profileError);
        // Continue without profile data
      } else {
        profile = profileData;
      }
    } catch (profileError) {
      console.error("Exception fetching profile:", profileError);
      // Continue without profile data
    }
    
    // Get user role with proper validation, first check if admin
    const isUserAdmin = await verifyUserRole(user.id, 'admin');
    let role = isUserAdmin ? 'admin' as const : 'user' as const;
    
    // If not admin, fetch the specific role to be sure
    if (!isUserAdmin) {
      try {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        
        // Validate role for type safety
        role = validateUserRole(roleData?.role);
      } catch (roleError) {
        console.warn("Error fetching role, defaulting to 'user':", roleError);
        // Keep default role as 'user'
      }
    }
    
    return {
      id: user.id,
      email: user.email || '',
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at || null,
      role,
      full_name: profile?.full_name || null,
      avatar_url: profile?.avatar_url || null
    };
  } catch (error) {
    console.error("Critical error in getSecureCurrentUser:", error);
    return null;
  }
}
