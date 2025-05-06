
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/user-types';

/**
 * User role management functions
 */

// Add admin role to a user
export async function addAdminRole(userId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('set_user_role', {
      target_user_id: userId, 
      new_role: 'admin'
    });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error setting admin role:', error);
    throw error;
  }
}

// Update user role
export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  try {
    const { error } = await supabase.rpc('set_user_role', {
      target_user_id: userId,
      new_role: role
    });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
}

// Assign a role to a user
export async function assignRole(userId: string, role: UserRole): Promise<void> {
  try {
    const { error } = await supabase.rpc('set_user_role', {
      target_user_id: userId,
      new_role: role
    });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error assigning role:', error);
    throw error;
  }
}

// Revoke user role/access
export async function revokeUserAccess(userId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('revoke_user_role', {
      target_user_id: userId
    });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error revoking user access:', error);
    throw error;
  }
}
