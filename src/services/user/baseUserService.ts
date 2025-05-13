
import { supabase } from '@/integrations/supabase/client';
import { isPreviewMode } from '@/services/previewService';
import { UserWithRole, validateUserRole } from '@/types/user-types';

// Check if a user is an admin
export const checkUserIsAdmin = async (userId: string): Promise<boolean> => {
  // In preview mode, always true for testing
  if (isPreviewMode()) {
    return true;
  }

  try {
    // Use the secure RPC function 
    const { data, error } = await supabase.rpc('is_admin_secure_fixed', { 
      _user_id: userId 
    });
    
    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// Type-safe role validation - re-export from user-types for convenience
export { validateUserRole } from '@/types/user-types';
