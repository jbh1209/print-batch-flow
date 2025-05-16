
/**
 * Simple cache version utility for component rendering
 */

// Generate a unique render key based on the current time
export const generateRenderKey = (): string => {
  return Date.now().toString();
};

// Force reload the current page - only used in extreme cases
export const forceReloadPage = (): void => {
  window.location.reload();
};

// Clear application cache in localStorage
export const clearAppCache = (): void => {
  // Useful for development only
  if (process.env.NODE_ENV === 'development') {
    // Clear localStorage items that might be causing issues
    localStorage.clear();
    console.log("Application cache cleared");
  }
};
