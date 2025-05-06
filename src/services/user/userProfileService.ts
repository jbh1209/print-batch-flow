
import { supabase } from '@/integrations/supabase/client';
import { UserFormData } from '@/types/user-types';

/**
 * User profile management functions
 */

// Update user profile - Enhanced for reliability
export async function updateUserProfile(userId: string, userData: UserFormData): Promise<void> {
  try {
    console.log('Updating user profile:', userId, userData);
    
    // Update user's full name in profiles table
    if (userData.full_name !== undefined) {
      console.log(`Updating user ${userId} name to "${userData.full_name}"`);
      
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          id: userId,
          full_name: userData.full_name 
        });
          
      if (error) {
        console.error('Error updating profile name:', error);
        throw error;
      }
    }
    
    // Update role if provided
    if (userData.role) {
      console.log(`Updating user ${userId} role to "${userData.role}"`);
      
      const { error } = await supabase.rpc('set_user_role', {
        target_user_id: userId,
        new_role: userData.role
      });
      
      if (error) {
        console.error('Error updating user role:', error);
        throw error;
      }
    }
    
    console.log('User profile updated successfully');
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}
