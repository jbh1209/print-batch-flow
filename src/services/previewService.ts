
/**
 * Preview Mode Service
 * 
 * Centralizes the detection of preview modes to ensure consistent behavior
 * across development and production environments.
 */

/**
 * Enhanced preview mode detection with multiple indicators
 * @returns boolean indicating if the application is running in preview mode
 */
export const isPreviewMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return window.location.hostname.includes('lovable.dev') || 
         window.location.hostname.includes('gpteng.co') ||
         window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1';
};

/**
 * Simulates an API call with a random delay for preview mode testing
 * @param minDelay Minimum delay in milliseconds
 * @param maxDelay Maximum delay in milliseconds
 * @returns Promise that resolves after the delay
 */
export const simulateApiCall = async (minDelay = 500, maxDelay = 1500): Promise<void> => {
  const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  return new Promise(resolve => setTimeout(resolve, delay));
};
