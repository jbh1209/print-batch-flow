
// Preview mode helpers to enable development without a backend

/**
 * Check if the application is running in preview mode
 */
export const isPreviewMode = (): boolean => {
  // Use environment variable, location.hostname check, or other mechanism
  // to determine if the app is running in preview/development mode
  return process.env.NODE_ENV === 'development' || 
    window.location.hostname === 'localhost' || 
    window.location.hostname.includes('preview');
};

/**
 * Get mock user data for preview mode
 */
export const getMockUserData = () => {
  return {
    id: 'preview-user-id',
    email: 'preview@example.com',
    full_name: 'Preview User',
    role: 'admin'
  };
};

/**
 * Simulate API delay for more realistic preview experience
 * @param minMs Minimum delay in milliseconds 
 * @param maxMs Maximum delay in milliseconds
 */
export const simulateApiDelay = async (minMs: number = 300, maxMs: number = 800): Promise<void> => {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
};

/**
 * Simulate a complete API call with success/failure based on probability
 * @param minMs Minimum delay in milliseconds
 * @param maxMs Maximum delay in milliseconds
 * @param successProbability Probability of success (0-1)
 */
export const simulateApiCall = async (
  minMs: number = 300, 
  maxMs: number = 800, 
  successProbability: number = 0.95
): Promise<boolean> => {
  await simulateApiDelay(minMs, maxMs);
  
  // Randomly determine success based on probability
  const isSuccess = Math.random() <= successProbability;
  
  if (!isSuccess) {
    throw new Error('Simulated API failure');
  }
  
  return true;
};
