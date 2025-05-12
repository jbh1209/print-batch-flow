
/**
 * Enhanced Preview Mode Detection Service
 * 
 * This service provides consistent detection of preview/development environments
 * across the entire application to ensure proper security behavior in different contexts.
 */

// Check if we're in a preview/development environment with multiple indicators
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

// Generate mock data for preview mode with proper type safety
export const generateMockData = <T extends object>(template: T, count: number = 5): T[] => {
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

// Security-related mock functions
export const generateRandomToken = (): string => {
  return 'mock-token-' + Math.random().toString(36).substring(2);
};

// Create consistent mock users for testing
export const getMockUsers = (count: number = 3): any[] => {
  const roles = ['admin', 'user', 'user'];
  
  return Array.from({ length: count }, (_, index) => ({
    id: `preview-${roles[index % roles.length]}-${index + 1}`,
    email: `${roles[index % roles.length]}${index + 1}@example.com`,
    full_name: `${roles[index % roles.length].charAt(0).toUpperCase() + roles[index % roles.length].slice(1)} User ${index + 1}`,
    role: roles[index % roles.length],
    created_at: new Date(Date.now() - index * 86400000).toISOString(),
    last_sign_in_at: new Date().toISOString(),
    avatar_url: null
  }));
};
