
/**
 * User Fetching Core Utilities
 * 
 * Provides secure methods for fetching multiple user records
 * with enhanced error handling, preview mode support, and multi-layered fallbacks.
 */
import { supabase } from '@/integrations/supabase/client';
import { UserWithRole, validateUserRole } from '@/types/user-types';
import { isPreviewMode, getPreviewMockData } from '@/services/previewService';

/**
 * Securely fetch all users with improved resilience and security
 * Uses multi-layered fallbacks and preview mode support
 * 
 * @returns Promise resolving to array of users with roles
 */
export async function secureGetAllUsers(): Promise<UserWithRole[]> {
  // In preview mode, return consistent mock data
  if (isPreviewMode()) {
    console.log("Preview mode detected in secureGetAllUsers, returning mock users");
    return [
      getPreviewMockData('admin') as UserWithRole,
      getPreviewMockData('user') as UserWithRole,
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
    console.log("Fetching all users with secure method");
    
    // Get current session to ensure we have a fresh token
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("Session error in secureGetAllUsers:", sessionError);
      throw new Error('Authentication error: Your session has expired. Please log out and log back in.');
    }
    
    if (!sessionData.session?.access_token) {
      console.error("No access token available in secureGetAllUsers");
      throw new Error('Authentication error: No valid session found. Please log in again.');
    }
    
    // APPROACH 1: Use RPC function (most reliable method)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_all_users_with_roles');
      
      if (rpcError) {
        console.warn("RPC get_all_users_with_roles failed:", rpcError);
        throw rpcError; // Try next approach
      }
      
      if (!rpcData || !Array.isArray(rpcData)) {
        throw new Error("Invalid data format from RPC");
      }
      
      // Process and validate the data
      const typedUsers = rpcData.map((user: any) => ({
        id: user.id,
        email: user.email || '',
        full_name: user.full_name || null,
        role: validateUserRole(user.role),
        created_at: user.created_at || new Date().toISOString(),
        last_sign_in_at: user.last_sign_in_at || null,
        avatar_url: user.avatar_url || null
      }));
      
      return typedUsers;
    } catch (rpcError) {
      console.warn("RPC approach failed, trying direct approach:", rpcError);
      
      // APPROACH 2: Direct queries with join
      // First get the basic user list
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          avatar_url
        `);
      
      if (usersError) {
        console.error("Error fetching users:", usersError);
        throw usersError;
      }
      
      // Then get roles for those users
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      if (rolesError) {
        console.error("Error fetching roles:", rolesError);
        // Continue without role data, defaulting to 'user'
      }
      
      // Create a map of user IDs to roles for easier lookup
      const roleMap = new Map();
      if (rolesData) {
        rolesData.forEach((roleEntry) => {
          roleMap.set(roleEntry.user_id, roleEntry.role);
        });
      }
      
      // Get email data from auth
      const { data: authData, error: authError } = await supabase.rpc('get_all_users_secure');
      
      if (authError) {
        console.error("Error fetching auth data:", authError);
        // Continue with partial data
      }
      
      // Create a map of user IDs to emails
      const emailMap = new Map();
      if (authData) {
        authData.forEach((authUser: any) => {
          emailMap.set(authUser.id, authUser.email);
        });
      }
      
      // Combine all the data
      const combinedUsers = usersData.map((user: any) => {
        const role = validateUserRole(roleMap.get(user.id));
        const email = emailMap.get(user.id) || 'email@unavailable.com';
        
        return {
          id: user.id,
          email,
          full_name: user.full_name || null,
          role,
          created_at: new Date().toISOString(), // Fallback
          last_sign_in_at: null,
          avatar_url: user.avatar_url || null
        } as UserWithRole;
      });
      
      return combinedUsers;
    }
  } catch (error: any) {
    console.error('Critical error in secureGetAllUsers:', error);
    
    // Return informative error that can be displayed to users
    throw new Error(`Failed to load users: ${error.message || "Unknown error"}`);
  }
}
