
/**
 * Core Preview Mode Service
 * 
 * IMPORTANT: This is an isolated service that doesn't depend on any other services
 * to prevent circular dependencies. It should NEVER import from other services.
 */

// Check if we're in preview mode
export const isPreviewMode = (): boolean => {
  return import.meta.env.MODE === 'development' || 
    (typeof window !== 'undefined' && (
      window.location.host.includes('preview') || 
      window.location.host.includes('localhost') ||
      window.location.host.includes('lovable')
    ));
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
