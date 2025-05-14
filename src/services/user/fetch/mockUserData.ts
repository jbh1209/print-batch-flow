
import { UserWithRole } from '@/types/user-types';
import { isPreviewMode, getMockUsers } from '@/services/previewService';

/**
 * Get mock user data for preview mode
 */
export const getMockUserData = (): UserWithRole[] => {
  if (isPreviewMode()) {
    console.log('Preview mode - using mock user data');
    return getMockUsers();
  }
  return [];
};

/**
 * Check if preview mode is enabled
 */
export const isInPreviewMode = (): boolean => {
  return isPreviewMode();
};
