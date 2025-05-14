
/**
 * User Fetch Controller
 * 
 * Handles cancellation and request management for user data fetching
 */

// Request controller for cancellation
let currentController: AbortController | null = null;

/**
 * Cancel any pending requests
 */
export const cancelFetchUsers = () => {
  if (currentController) {
    console.log('Cancelling user fetch request');
    currentController.abort();
    currentController = null;
  }
};

/**
 * Create new controller for fetch requests
 * @returns AbortSignal for the request
 */
export const createFetchController = (): AbortSignal => {
  // Cancel any pending requests
  if (currentController) {
    console.log('Cancelling existing user fetch request');
    currentController.abort();
  }
  
  // Create new controller for this request
  currentController = new AbortController();
  return currentController.signal;
};

/**
 * Reset controller after request completes
 */
export const resetFetchController = () => {
  currentController = null;
};

/**
 * Invalidate user cache
 * This is a no-op function to maintain API compatibility
 */
export const invalidateUserCache = () => {
  console.log('User cache invalidated - no caching is used anymore');
};
