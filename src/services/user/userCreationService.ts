
import { supabase, trackApiRequest } from '@/integrations/supabase/client';
import { isPreviewMode, simulateApiDelay } from '@/services/previewService';
import { invalidateUserCache } from './userFetchService';
import { UserRole } from '@/types/user-types';

/**
 * User creation data with simplified structure
 * This interface is used externally by components
 */
export interface UserCreationData {
  email: string;
  password: string;
  full_name?: string;
  role?: UserRole;
}

/**
 * Create a new user with proper error handling
 */
export const createUser = async (userData: UserCreationData): Promise<void> => {
  // In preview mode, simulate success
  if (isPreviewMode()) {
    await simulateApiDelay(800, 1500);
    invalidateUserCache(); // Clear cache
    return;
  }
  
  try {
    console.log("Creating user:", userData.email);
    
    // Step 1: Create the user account through auth API
    // Avoid type recursion by using direct object without type annotations
    const { error: authError } = await supabase.auth.admin.createUser({
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
    const profileResult = await supabase
      .from('profiles')
      .select('id')
      .eq('email', userData.email)
      .maybeSingle();
    
    if (profileResult.error) {
      throw profileResult.error;
    }
    
    const userId = profileResult.data?.id;
    if (!userId) {
      throw new Error("Created user not found");
    }
    
    // Step 3: Set the user role if specified
    if (userData.role) {
      const roleResult = await supabase.rpc('set_user_role_admin', {
        _target_user_id: userId,
        _new_role: userData.role
      });
      
      if (roleResult.error) {
        throw roleResult.error;
      }
    }
    
    // Step 4: Invalidate cache and track successful request
    invalidateUserCache();
    trackApiRequest(true);
  } catch (error) {
    console.error("Creating user error:", error);
    trackApiRequest(false);
    throw error;
  }
};
