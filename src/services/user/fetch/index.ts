
/**
 * User Fetch Service Index
 * 
 * IMPORTANT: This file uses explicit named exports ONLY to prevent unwanted
 * data fetching during module initialization. Do NOT use wildcard exports.
 */

// Export only the controller functions that don't trigger fetches
export { 
  createFetchController,
  resetFetchController,
  cancelFetchUsers,
  invalidateUserCache
} from './userFetchController';

// Export transformer function (safe, no side effects)
export { transformUserData } from './userDataTransformer';

// Export mock data functions - these are safe to re-export directly
export { 
  isInPreviewMode,
  getMockUserData 
} from './mockUserData';

// DO NOT re-export fetchUsers functions here!
// Instead, import them directly from the source files when needed
// export * from './userDataService'; // <-- REMOVED to prevent unintended importing
