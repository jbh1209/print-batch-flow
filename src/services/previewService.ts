
/**
 * Central source of truth for preview mode detection
 */

// Detect preview environments based on hostname
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

// Get consistent mock data for preview mode
export const getMockUserData = () => ({
  id: 'preview-user-id',
  email: 'preview@example.com',
  role: 'admin',
  full_name: 'Preview User',
  avatar_url: null,
  isAdmin: true
});

// Simulate API delays for better UX testing
export const simulateApiDelay = async (minMs = 300, maxMs = 800): Promise<void> => {
  if (!isPreviewMode()) return;
  
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
};

// Alias for simulateApiDelay for backward compatibility
export const simulateApiCall = simulateApiDelay;
