
/**
 * Authentication Verification Core Utilities
 * 
 * Provides core verification functionality for authentication tokens,
 * sessions, and user roles with improved security.
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
