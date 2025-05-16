
/**
 * Cache utilities for the application
 */

// Generate a unique key that can be used for forcing component re-renders
// This is useful for situations where we need to bypass React's reconciliation
export const generateRenderKey = () => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Clear all browser cache - only for development/debugging
// This can be called from a debug button or console
export const clearAllBrowserCache = async () => {
  if (window.caches) {
    try {
      const cacheNames = await window.caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => window.caches.delete(cacheName))
      );
      console.log('All cache storage cleared');
      return true;
    } catch (err) {
      console.error('Error clearing cache:', err);
      return false;
    }
  }
  return false;
};

// Force a full page refresh, bypassing any cache
export const forcePageRefresh = () => {
  window.location.reload();
};

// Force a full navigation to a specific route
export const forceNavigate = (route: string) => {
  window.location.href = route;
};

// Add a debug component to help diagnose rendering issues
// This should be added to components that might have caching issues
export const addDebugInfo = (component: string) => {
  console.log(`${component} rendered at ${new Date().toISOString()}`);
};
