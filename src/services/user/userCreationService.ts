
import { supabase, trackApiRequest } from '@/integrations/supabase/client';
import { isPreviewMode, simulateApiDelay } from '@/services/previewService';
import { invalidateUserCache } from './userFetchService';

// Define a simpler interface for user data to avoid deep type recursion
interface UserCreationData {
  email: string;
  password: string;
  full_name?: string;
  role?: 'admin' | 'user';
}

// Interface for admin createUser parameters to avoid deep type inference
interface AdminCreateUserParams {
  email: string;
  password: string;
  email_confirm: boolean;
  user_metadata: {
    full_name: string;
  }
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
    
    // Step 1: Create the user account through auth API with explicit typing
    const createUserParams: AdminCreateUserParams = {
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        full_name: userData.full_name || ''
      }
    };
    
    const authResult = await supabase.auth.admin.createUser(createUserParams);
    
    if (authResult.error) {
      throw authResult.error;
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
