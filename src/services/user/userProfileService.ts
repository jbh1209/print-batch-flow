
import { supabase, trackApiRequest } from '@/integrations/supabase/client';
import { isPreviewMode, simulateApiDelay } from '@/services/previewService';
import { invalidateUserCache } from './userFetchService';

/**
 * Update an existing user
 */
export const updateUser = async (
  userId: string, 
  userData: { 
    full_name?: string; 
    role?: 'admin' | 'user';
  }
): Promise<void> => {
  // In preview mode, simulate success
  if (isPreviewMode()) {
    await simulateApiDelay(500, 1000);
    invalidateUserCache(); // Clear cache
    return;
  }
  
  try {
    // Update profile if needed
    if (userData.full_name !== undefined) {
      const { error } = await supabase.rpc('update_user_profile_admin', {
        _user_id: userId,
        _full_name: userData.full_name
      });
      
      if (error) throw error;
    }
    
    // Update role if needed
    if (userData.role) {
      const { error } = await supabase.rpc('set_user_role_admin', {
        _target_user_id: userId,
        _new_role: userData.role
      });
      
      if (error) throw error;
    }
    
    invalidateUserCache(); // Clear cache
    trackApiRequest(true);
  } catch (error) {
    console.error("Error updating user:", error);
    trackApiRequest(false);
    throw error;
  }
};

/**
 * Delete/revoke access for a user
 */
export const deleteUser = async (userId: string): Promise<void> => {
  // In preview mode, simulate success
  if (isPreviewMode()) {
    await simulateApiDelay(500, 1000);
    invalidateUserCache(); // Clear cache
    return;
  }
  
  try {
    const { error } = await supabase.rpc('revoke_user_role', {
      target_user_id: userId
    });
    
    if (error) throw error;
    
    invalidateUserCache(); // Clear cache
    trackApiRequest(true);
  } catch (error) {
    console.error("Error deleting user:", error);
    trackApiRequest(false);
    throw error;
  }
};
