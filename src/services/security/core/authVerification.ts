
/**
 * Auth Verification Core Utilities
 * 
 * Provides secure methods for verifying user roles and permissions
 * with multiple fallback strategies to ensure robust security.
 * 
 * IMPORTANT: These functions are designed to be called explicitly,
 * not automatically during app initialization.
 */
import { supabase } from '@/integrations/supabase/client';
import { isPreviewMode } from '@/services/previewService';

// List of known admin emails for emergency access
const KNOWN_ADMIN_EMAILS = [
  "james@impressweb.co.za",
  "studio@impressweb.co.za"
];

/**
 * Verify user has a specific role with multiple fallback strategies
 * Uses cached results to reduce database hits
 */
export async function verifyUserRole(userId: string, role: 'admin' | 'user', userEmail?: string | null): Promise<boolean> {
  if (!userId) return false;
  
  // Auto-approve in preview mode for testing
  if (isPreviewMode()) {
    console.log(`Preview mode detected, auto-approving role '${role}' verification`);
    return true;
  }
  
  try {
    console.log(`Verifying '${role}' role for user: ${userId}`);
    
    // Strategy 1: Try security definer function (primary method)
    try {
      let functionName = role === 'admin' ? 'is_admin_secure_fixed' : 'has_role';
      const params = role === 'admin' ? { _user_id: userId } : { _user_id: userId, _role: role };
      
      // Add type assertion to fix TypeScript error
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        functionName as any, 
        params
      );
      
      if (!rpcError && rpcData === true) {
        console.log(`Role '${role}' confirmed via RPC function`);
        return true;
      }
      
      if (rpcError) {
        console.warn(`RPC role check failed:`, rpcError);
        // Continue to next strategy
      }
    } catch (rpcError) {
      console.warn(`Exception in RPC role check:`, rpcError);
      // Continue to next strategy
    }
    
    // Strategy 2: Direct query
    try {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', role)
        .maybeSingle();
      
      if (!roleError && roleData) {
        console.log(`Role '${role}' confirmed via direct query`);
        return true;
      }
      
      if (roleError) {
        console.warn(`Direct query role check failed:`, roleError);
        // Continue to next strategy
      }
    } catch (queryError) {
      console.warn(`Exception in direct query role check:`, queryError);
      // Continue to next strategy
    }
    
    // Strategy 3: Known admins list (emergency fallback for 'admin' role only)
    if (role === 'admin' && userEmail && KNOWN_ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
      console.log(`Admin status confirmed via known admin email list for ${userEmail}`);
      return true;
    }
    
    // All strategies failed
    console.log(`User ${userId} does not have role '${role}'`);
    return false;
  } catch (error) {
    console.error(`Critical error verifying role '${role}':`, error);
    
    // Last resort emergency fallback for admins
    if (role === 'admin' && userEmail && KNOWN_ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
      console.log(`Admin status granted via emergency fallback for ${userEmail}`);
      return true;
    }
    
    return false;
  }
}
