
import { UserWithRole, validateUserRole } from '@/types/user-types';
import { isPreviewMode, getMockUsers } from '@/services/previewService';

/**
 * Get mock user data for preview mode
 */
export const getMockUserData = (): UserWithRole[] => {
  if (isPreviewMode()) {
    console.log('Preview mode - using mock user data');
    const mockUsers = getMockUsers();
    
    // Transform and validate the mock data to ensure correct typing
    return mockUsers.map(user => ({
      ...user,
      role: validateUserRole(user.role), // Validate the role to ensure it's a proper UserRole type
      full_name: user.full_name || null,
      avatar_url: user.avatar_url || null,
      last_sign_in_at: user.last_sign_in_at || null,
    }));
  }
  return [];
};

/**
 * Check if preview mode is enabled
 */
export const isInPreviewMode = (): boolean => {
  return isPreviewMode();
};
