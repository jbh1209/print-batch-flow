
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/user-types';

/**
 * User role management functions
 */

// Add admin role to a user
export async function addAdminRole(userId: string): Promise<void> {
  try {
    console.log('Setting admin role for user:', userId);
    
    // Use direct SQL query instead of RPC call
    const { error } = await supabase
      .from('user_roles')
      .upsert({ 
        user_id: userId, 
        role: 'admin',
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'user_id' 
      });
    
    if (error) {
      console.error('Error setting admin role:', error);
      throw error;
    }
  } catch (error) {
    console.error('Exception in addAdminRole:', error);
    throw error;
  }
}

// Update user role - using SQL query instead of function
export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  try {
    console.log(`Updating user ${userId} role to ${role}`);
    
    const { error } = await supabase
      .from('user_roles')
      .upsert({ 
        user_id: userId, 
        role: role,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'user_id' 
      });
    
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
    
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error revoking user access:', error);
      throw error;
    }
  } catch (error) {
    console.error('Exception in revokeUserAccess:', error);
    throw error;
  }
}
