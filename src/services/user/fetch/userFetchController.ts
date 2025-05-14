
/**
 * User Fetch Controller
 * 
 * Provides utilities for managing user data fetching, including
 * cache invalidation and request cancellation.
 */

// Module-level controller reference for cancellation
let currentController: AbortController | null = null;

// Cache invalidation timestamp
let cacheInvalidatedAt: number = 0;

/**
 * Create a new fetch controller and return its signal
 */
export const createFetchController = (): AbortController => {
  // Cancel any existing request
  if (currentController) {
    currentController.abort();
  }
  
  // Create new controller
  currentController = new AbortController();
  return currentController;
};

/**
 * Reset the current fetch controller
 */
export const resetFetchController = (): void => {
  currentController = null;
};

/**
 * Cancel any ongoing user fetch request
 */
export const cancelFetchUsers = (): void => {
  if (currentController) {
    currentController.abort();
    currentController = null;
    console.log('User fetch requests cancelled');
  }
};

/**
 * Invalidate the user cache to force a fresh fetch
 */
export const invalidateUserCache = (): void => {
  cacheInvalidatedAt = Date.now();
  console.log('User cache invalidated');
};

/**
 * Check if the user cache is still valid
 */
export const isCacheValid = (maxAgeMs: number = 30000): boolean => {
  if (cacheInvalidatedAt === 0) return false;
  const timeSinceInvalidation = Date.now() - cacheInvalidatedAt;
  return timeSinceInvalidation < maxAgeMs;
};
