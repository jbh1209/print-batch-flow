
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
    console.log("Creating user via edge function:", userData.email);
    
    // Get the current session for authorization
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Authentication required to create users');
    }
    
    // Use the edge function to create the user securely
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        email: userData.email,
        password: userData.password,
        full_name: userData.full_name || '',
        role: userData.role || 'user'
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });
    
    if (error) {
      console.error("Edge function error:", error);
      throw error;
    }
    
    // Invalidate cache and track successful request
    invalidateUserCache();
    trackApiRequest(true);
    
    return data;
  } catch (error) {
    console.error("Creating user error:", error);
    trackApiRequest(false);
    throw error;
  }
};
