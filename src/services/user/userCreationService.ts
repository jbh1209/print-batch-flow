
import { supabase, trackApiRequest } from '@/integrations/supabase/client';
import { isPreviewMode, simulateApiDelay } from '@/services/previewService';
import { invalidateUserCache } from './userFetchService';

/**
 * Create a new user with proper error handling
 */
export const createUser = async (userData: {
  email: string;
  password: string;
  full_name?: string;
  role?: 'admin' | 'user';
}): Promise<void> => {
  // In preview mode, simulate success
  if (isPreviewMode()) {
    await simulateApiDelay(800, 1500);
    invalidateUserCache(); // Clear cache
    return;
  }
  
  try {
    // Create the user account
    const { error } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        full_name: userData.full_name || ''
      }
    });
    
    if (error) throw error;
    
    // Get the user ID from the newly created user
    const { data: newUserProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', userData.email)
      .single();
    
    if (!newUserProfile?.id) throw new Error("Created user not found");
    
    // Set the user role if specified
    if (userData.role) {
      const { error: roleError } = await supabase.rpc('set_user_role_admin', {
        _target_user_id: newUserProfile.id,
        _new_role: userData.role
      });
      
      if (roleError) throw roleError;
    }
    
    invalidateUserCache(); // Clear cache
    trackApiRequest(true);
  } catch (error) {
    console.error("Error creating user:", error);
    trackApiRequest(false);
    throw error;
  }
};
