
/**
 * User Access Core Utilities
 * 
 * Provides secure methods for retrieving and working with 
 * authenticated user data.
 */
import { supabase } from '@/integrations/supabase/client';
import { UserWithRole, validateUserRole } from '@/types/user-types';
import { isPreviewMode } from '@/services/previewService';

/**
 * Get current user with enhanced security checks and proper type handling
 * @returns Promise resolving to the current authenticated user or null
 */
export async function getSecureCurrentUser(): Promise<UserWithRole | null> {
  // For preview mode, return a mock user
  if (isPreviewMode()) {
    console.log("Preview mode detected, using mock user data");
    return {
      id: "preview-admin-1",
      email: "admin@example.com",
      created_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      role: "admin", 
      full_name: "Preview Admin",
      avatar_url: null
    };
  }

  try {
    // Get current session with improved error handling
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !sessionData.session) {
      console.log("No valid session found");
      return null;
    }
    
    const { user } = sessionData.session;
    if (!user) return null;
    
    // First get the basic user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    
    // Get user role with proper validation
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    
    // Validate role to ensure type safety
    const role = validateUserRole(roleData?.role);
    
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
    console.error("Error getting secure current user:", error);
    return null;
  }
}
