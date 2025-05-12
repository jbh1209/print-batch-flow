
/**
 * Authentication Verification Core Utilities
 * 
 * Provides core verification functionality for authentication tokens,
 * sessions, and user roles with improved security.
 */
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/user-types';
import { isPreviewMode } from '@/services/previewService';

/**
 * Verify that a user has a specific role using the most secure method available
 * Uses a multi-layered approach to avoid recursion issues
 * 
 * @param userId User ID to check
 * @param role Role to verify
 * @returns Promise resolving to boolean indicating if the user has the role
 */
export async function verifyUserRole(userId: string, role: UserRole): Promise<boolean> {
  // For testing and preview mode, allow specific test IDs to pass verification
  if (isPreviewMode()) {
    console.log(`Preview mode detected in verifyUserRole for user ${userId}`);
    if (role === 'admin' && userId.startsWith('preview-admin')) return true;
    if (role === 'user' && userId.startsWith('preview-user')) return true;
    return false;
  }
  
  if (!userId) {
    console.warn('Empty userId passed to verifyUserRole');
    return false;
  }
  
  try {
    console.log(`Verifying role '${role}' for user ${userId}`);
    
    // APPROACH 1: Use the secure RPC function that avoids RLS recursion
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'is_admin_secure_fixed',
      { _user_id: userId }
    );
    
    if (rpcError) {
      console.warn(`RPC role check failed: ${rpcError.message}`);
      // Continue to backup approach
    } else if (role === 'admin') {
      return !!rpcData;
    } else if (rpcData === true) {
      // Admin users have all roles
      return true;
    }
    
    // APPROACH 2: Direct query with retry logic
    try {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', role)
        .maybeSingle();
      
      if (roleError) {
        console.warn(`Direct role query failed: ${roleError.message}`);
        throw roleError;
      }
      
      return !!roleData;
    } catch (directQueryError) {
      console.warn(`Error in direct role query: ${directQueryError}`);
      
      // APPROACH 3: Last resort fallback using less specific query
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (fallbackError) {
        console.error(`All role verification methods failed for user ${userId}`);
        return false;
      }
      
      return fallbackData?.role === role;
    }
  } catch (error) {
    console.error(`Critical error verifying role ${role} for user ${userId}:`, error);
    return false;
  }
}
