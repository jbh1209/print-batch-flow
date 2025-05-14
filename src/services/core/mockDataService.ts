
/**
 * Mock Data Service
 * 
 * Provides isolated mock data without dependencies on other services.
 * IMPORTANT: This file should not import any other services to prevent circular dependencies.
 */
import { isPreviewMode } from './previewService';

// Basic interface definitions (duplicated to avoid circular imports)
interface MockUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
}

/**
 * Get mock user for preview mode
 */
export const getMockUserData = (): { id: string; email: string; full_name: string } => {
  return {
    id: 'preview-user-123',
    email: 'admin@example.com',
    full_name: 'Preview Admin',
  };
};

/**
 * Get mock users list
 */
export const getMockUsers = (): MockUser[] => {
  return [
    {
      id: 'preview-user-123',
      email: 'admin@example.com',
      full_name: 'Preview Admin',
      avatar_url: null,
      role: 'admin',
      created_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
    },
    {
      id: 'preview-user-456',
      email: 'user@example.com',
      full_name: 'Regular User',
      avatar_url: null,
      role: 'user',
      created_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
    }
  ];
};

/**
 * Check if preview mode is enabled - Safe wrapper that doesn't cause circular imports
 */
export const isInPreviewMode = (): boolean => {
  return isPreviewMode();
};
