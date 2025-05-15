
import { supabase } from '@/integrations/supabase/client';
import { UserFormData } from '@/types/user-types';

/**
 * User profile management functions
 */

// Update user profile - Using secure functions
export async function updateUserProfile(userId: string, userData: UserFormData): Promise<void> {
  try {
    if (!userId) {
      throw new Error('No user ID provided');
    }
    
    console.log('Updating user profile:', userId, userData);
    
    // Update user's full name in profiles table if provided
    if (userData.full_name !== undefined) {
      console.log(`Updating user ${userId} name to "${userData.full_name}"`);
      
      const { error } = await supabase.rpc('update_user_profile_admin', {
        _user_id: userId,
        _full_name: userData.full_name
      });
      
      if (error) {
        console.error('Error updating profile:', error);
        throw error;
      }
    }
    
    // Update role if provided
    if (userData.role) {
      console.log(`Updating user ${userId} role to "${userData.role}"`);
      
      const { error } = await supabase.rpc('set_user_role_admin', {
        _target_user_id: userId,
        _new_role: userData.role
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

// Get user profile by ID - Simplified with better error handling
export async function getUserProfile(userId: string) {
  try {
    if (!userId) return null;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
      
    if (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    return null;
  }
}
