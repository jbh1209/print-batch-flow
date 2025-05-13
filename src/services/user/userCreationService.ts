
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
    // Step 1: Create the user account through auth API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        full_name: userData.full_name || ''
      }
    });
    
    if (authError) {
      throw authError;
    }
    
    // Step 2: Fetch the profile ID for the newly created user
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', userData.email)
      .single();
    
    if (profileError) {
      throw profileError;
    }
    
    const userId = profileData?.id;
    if (!userId) {
      throw new Error("Created user not found");
    }
    
    // Step 3: Set the user role if specified
    if (userData.role) {
      const { error: roleError } = await supabase.rpc('set_user_role_admin', {
        _target_user_id: userId,
        _new_role: userData.role
      });
      
      if (roleError) {
        throw roleError;
      }
    }
    
    // Step 4: Invalidate cache and track successful request
    invalidateUserCache();
    trackApiRequest(true);
  } catch (error) {
    console.error("Error creating user:", error);
    trackApiRequest(false);
    throw error;
  }
};
