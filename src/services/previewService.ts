
/**
 * Preview Mode Detection Service
 * 
 * This service provides consistent detection of preview/development environments
 * across the entire application to ensure proper functionality in different contexts.
 */

// Check if we're in a preview/development environment
export const isPreviewMode = (): boolean => {
  // Multiple indicators for preview mode detection
  return (
    // Check if the explicit flag is set
    typeof isLovablePreview !== 'undefined' && isLovablePreview === true ||
    
    // Check hostname indicators
    typeof window !== 'undefined' && (
      window.location.hostname.includes('lovable.dev') ||
      window.location.hostname.includes('gpteng.co') ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    )
  );
};

// Global reference for use in non-React contexts
export const isLovablePreview = 
  typeof window !== 'undefined' && (
    window.location.hostname.includes('lovable.dev') ||
    window.location.hostname.includes('gpteng.co')
  );

// Generate mock data for preview mode
export const generateMockData = <T>(template: T, count: number = 5): T[] => {
  return Array.from({ length: count }, (_, index) => ({
    ...template,
    id: `preview-id-${index + 1}`,
    created_at: new Date(Date.now() - index * 86400000).toISOString(), // Different dates
  }));
};

// Simulate API call timing for more realistic preview behavior
export const simulateApiCall = async (minDelay: number = 300, maxDelay: number = 800): Promise<void> => {
  const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  return new Promise(resolve => setTimeout(resolve, delay));
};
