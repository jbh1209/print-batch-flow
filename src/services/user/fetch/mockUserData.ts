
/**
 * Re-export mock user data from core services to prevent circular dependencies
 * 
 * This file only contains exports and no implementation logic to prevent
 * inadvertent circular dependencies and service calls during build
 */
import { getMockUsers } from '@/services/core/mockDataService';
import { isPreviewMode } from '@/services/core/previewService';
import { UserWithRole, validateUserRole } from '@/types/user-types';

/**
 * Get mock user data for preview mode
 * 
 * IMPORTANT: This function will only execute when explicitly called
 */
export const getMockUserData = (): UserWithRole[] => {
  if (!isPreviewMode()) {
    return [];
  }
  
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
};

/**
 * Safely check if preview mode is enabled
 * Uses the isolated core service to prevent circular dependencies
 */
export const isInPreviewMode = (): boolean => {
  return isPreviewMode();
};
