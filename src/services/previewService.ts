
/**
 * Preview mode service
 * Provides utilities for working in preview or demo mode
 * without needing real Supabase connection
 */

// Check if we're in preview mode
export const isPreviewMode = (): boolean => {
  return import.meta.env.MODE === 'development' || 
    window.location.host.includes('preview') || 
    window.location.host.includes('localhost') ||
    window.location.host.includes('lovable');
};

// Simulate API delay to emulate real-world experience
export const simulateApiDelay = async (min: number = 300, max: number = 800): Promise<void> => {
  const delay = Math.floor(Math.random() * (max - min + 1) + min);
  await new Promise(resolve => setTimeout(resolve, delay));
};

// Simulate API call with random response time
export const simulateApiCall = async (min: number = 500, max: number = 1200): Promise<void> => {
  await simulateApiDelay(min, max);
};

// Get mock user data for preview mode
export const getMockUserData = () => {
  return {
    id: 'preview-user-123',
    email: 'admin@example.com',
    full_name: 'Preview Admin',
  };
};

// Get mock users list
export const getMockUsers = () => {
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
