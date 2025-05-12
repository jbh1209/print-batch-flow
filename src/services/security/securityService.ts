
/**
 * Centralized Security Service 
 * 
 * Provides unified security operations for authentication, authorization,
 * and secure data access across development and production environments.
 */
import { supabase, adminClient } from '@/integrations/supabase/client';
import { UserRole, UserWithRole, validateUserRole } from '@/types/user-types';
import { isPreviewMode } from '@/services/previewService';

/**
 * Verify that a user has a specific role using the most secure method available
 * @param userId User ID to check
 * @param role Role to verify
 * @returns Promise resolving to boolean indicating if the user has the role
 */
export async function verifyUserRole(userId: string, role: UserRole): Promise<boolean> {
  // In preview mode, allow specific test IDs to pass verification
  if (isPreviewMode()) {
    // Special preview IDs for testing role scenarios
    if (role === 'admin' && userId.startsWith('preview-admin')) return true;
    if (role === 'user' && userId.startsWith('preview-user')) return true;
    return false;
  }
  
  try {
    // Use the improved secure RPC function that avoids RLS recursion
    const { data, error } = await supabase.rpc(
      'is_admin_secure_fixed',
      { _user_id: userId }
    );
    
    if (error) throw error;
    
    // For admin check, we can directly return the result
    if (role === 'admin') {
      return !!data;
    }
    
    // For non-admin roles, check specifically for that role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', role)
      .maybeSingle();
    
    if (roleError) throw roleError;
    return !!roleData;
  } catch (error) {
    console.error(`Error verifying role ${role} for user ${userId}:`, error);
    return false;
  }
}

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
      last_sign_in_at: new Date().toISOString(), // Fixed property name
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
      last_sign_in_at: user.last_sign_in_at || null, // Fixed property name
      role,
      full_name: profile?.full_name || null,
      avatar_url: profile?.avatar_url || null
    };
  } catch (error) {
    console.error("Error getting secure current user:", error);
    return null;
  }
}

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

/**
 * Secure fetch users implementation with enhanced security and preview mode support
 * Uses multiple fallback strategies for resilience
 */
export async function secureGetAllUsers(): Promise<UserWithRole[]> {
  // In preview mode, return mock data
  if (isPreviewMode()) {
    console.log("Preview mode detected, returning mock users data");
    return [
      {
        id: "preview-admin-1",
        email: "admin@example.com",
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        role: "admin", 
        full_name: "Preview Admin",
        avatar_url: null
      },
      {
        id: "preview-user-1",
        email: "user@example.com",
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        role: "user",
        full_name: "Regular User",
        avatar_url: null
      },
      {
        id: "preview-user-2",
        email: "dev@example.com",
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        role: "user",
        full_name: "Developer User",
        avatar_url: null
      }
    ];
  }
  
  try {
    // Get current session to ensure we have a fresh token
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !sessionData.session?.access_token) {
      throw new Error('Authentication error: Your session has expired. Please log out and log back in.');
    }
    
    // APPROACH 1: Use the functions client with proper headers
    try {
      const { data, error } = await adminClient.functions.invoke('get-all-users', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (error) throw error;
      
      if (!data || !Array.isArray(data)) {
        throw new Error("Invalid data format received from functions API");
      }
      
      // Ensure role values are valid
      const typedUsers = data.map((user: any) => ({
        ...user,
        role: validateUserRole(user.role)
      }));
      
      return typedUsers;
    } 
    catch (invocationError) {
      console.error("Function invocation failed:", invocationError);
      
      // APPROACH 2: Direct fetch as fallback with enhanced security headers
      console.log('Falling back to direct fetch');
      const response = await fetch(`https://kgizusgqexmlfcqfjopk.supabase.co/functions/v1/get-all-users`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        // Add timeout for the fetch request
        signal: AbortSignal.timeout(8000)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error("Invalid response format from edge function");
      }
      
      // Ensure role values are valid by mapping them to the allowed types
      const typedUsers = data.map((user: any) => ({
        ...user,
        role: validateUserRole(user.role)
      }));
      
      return typedUsers;
    }
  } catch (error: any) {
    console.error('Error in secureGetAllUsers:', error);
    throw error;
  }
}
