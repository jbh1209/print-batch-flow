
/**
 * Preview Mode Detection Service
 * 
 * Provides a single source of truth for detecting preview/development environments
 * to ensure consistent behavior across the application.
 */

/**
 * Determines if the application is running in a preview environment
 * This is the SINGLE source of truth for environment detection
 */
export const isPreviewMode = (): boolean => {
  // Check for preview environments based on hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    return hostname.includes('lovable.dev') || 
           hostname.includes('gpteng.co') ||
           hostname === 'localhost' || 
           hostname === '127.0.0.1';
  }
  return false;
};

/**
 * Simulates an API call delay for preview mode
 * Used to provide realistic UI feedback when in preview mode
 * 
 * @param minMs Minimum delay in milliseconds
 * @param maxMs Maximum delay in milliseconds
 */
export const simulateApiCall = async (minMs = 500, maxMs = 1500): Promise<void> => {
  if (!isPreviewMode()) return;
  
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
};

/**
 * Gets mock data appropriate for the current preview environment
 * Provides consistent test data across the application
 * 
 * @param dataType Type of mock data to retrieve
 * @returns Appropriate mock data object
 */
export const getPreviewMockData = (dataType: 'user' | 'admin' | 'batch' | 'job'): any => {
  switch (dataType) {
    case 'user':
      return {
        id: 'preview-user-1',
        email: 'user@example.com',
        full_name: 'Preview User',
        role: 'user',
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString()
      };
      
    case 'admin':
      return {
        id: 'preview-admin-1',
        email: 'admin@example.com',
        full_name: 'Preview Admin',
        role: 'admin',
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString()
      };
      
    // Add more mock data types as needed
    default:
      return null;
  }
};
