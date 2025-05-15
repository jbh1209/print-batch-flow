
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/user-types';

/**
 * User role management functions
 */

// Add admin role to a user
export async function addAdminRole(userId: string): Promise<void> {
  try {
    console.log('Setting admin role for user:', userId);
    
    // Using explicit typecasting to handle TypeScript limitations with dynamic RPC calls
    const { error } = await supabase.rpc('set_user_role_admin', {
      _target_user_id: userId, 
      _new_role: 'admin'
    }) as unknown as Promise<{ error: any }>;
    
    if (error) {
      console.error('Error setting admin role:', error);
      throw error;
    }
  } catch (error) {
    console.error('Exception in addAdminRole:', error);
    throw error;
  }
}

// Update user role - using secure function
export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  try {
    console.log(`Updating user ${userId} role to ${role}`);
    
    // Using explicit typecasting to handle TypeScript limitations with dynamic RPC calls
    const { error } = await supabase.rpc('set_user_role_admin', {
      _target_user_id: userId,
      _new_role: role
    }) as unknown as Promise<{ error: any }>;
    
    if (error) {
      console.error('Error updating role:', error);
      throw error;
    }
  } catch (error) {
    console.error('Exception in updateUserRole:', error);
    throw error;
  }
}

// Revoke user role/access
export async function revokeUserAccess(userId: string): Promise<void> {
  try {
    console.log(`Revoking access for user ${userId}`);
    
    // Using explicit typecasting to handle TypeScript limitations with dynamic RPC calls
    const { error } = await supabase.rpc('revoke_user_role', {
      target_user_id: userId
    }) as unknown as Promise<{ error: any }>;
    
    if (error) {
      console.error('Error revoking user access:', error);
      throw error;
    }
  } catch (error) {
    console.error('Exception in revokeUserAccess:', error);
    throw error;
  }
}
