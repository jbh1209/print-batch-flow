
/**
 * Utility functions for managing cache and forcing component refreshes
 */

// Generate a unique cache key based on the current time
export const generateCacheKey = (): string => {
  return Date.now().toString();
};

// Store the current cache version in localStorage
export const setCacheVersion = (version: string): void => {
  localStorage.setItem('app_cache_version', version);
};

// Get the current cache version from localStorage
export const getCacheVersion = (): string => {
  return localStorage.getItem('app_cache_version') || '0';
};

// Check if a component needs to be refreshed based on cache version
export const shouldRefreshComponent = (componentId: string): boolean => {
  const lastVersion = localStorage.getItem(`component_version_${componentId}`);
  const currentVersion = getCacheVersion();
  
  if (lastVersion !== currentVersion) {
    localStorage.setItem(`component_version_${componentId}`, currentVersion);
    return true;
  }
  
  return false;
};

// Force reload the current page
export const forceReloadPage = (): void => {
  window.location.reload();
};

// Clear application cache in localStorage
export const clearAppCache = (): void => {
  // Set a new cache version
  setCacheVersion(generateCacheKey());
  
  // Remove any component-specific cache items
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('component_version_')) {
      keysToRemove.push(key);
    }
  }
  
  // Remove the keys in a separate loop to avoid issues with the iteration
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  console.log("Application cache cleared");
};
