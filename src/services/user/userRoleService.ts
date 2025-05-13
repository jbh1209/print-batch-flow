
import { supabase, trackApiRequest } from '@/integrations/supabase/client';
import { isPreviewMode, simulateApiDelay } from '@/services/previewService';
import { invalidateUserCache } from './userFetchService';

/**
 * Check if any admin exists in the system
 */
export const checkAdminExists = async (): Promise<boolean> => {
  // In preview mode, always true
  if (isPreviewMode()) {
    await simulateApiDelay(300, 700);
    return true;
  }
  
  try {
    const { data, error } = await supabase.rpc('any_admin_exists');
    
    if (error) throw error;
    trackApiRequest(true);
    return !!data;
  } catch (error) {
    console.error("Error checking admin existence:", error);
    trackApiRequest(false);
    return false;
  }
};

/**
 * Add admin role to a user
 */
export const addAdminRole = async (userId: string): Promise<void> => {
  // In preview mode, simulate success
  if (isPreviewMode()) {
    await simulateApiDelay(500, 1000);
    invalidateUserCache(); // Clear cache
    return;
  }
  
  try {
    const { error } = await supabase.rpc('add_admin_role', {
      admin_user_id: userId
    });
    
    if (error) throw error;
    
    invalidateUserCache(); // Clear cache
    trackApiRequest(true);
  } catch (error) {
    console.error("Error adding admin role:", error);
    trackApiRequest(false);
    throw error;
  }
};
