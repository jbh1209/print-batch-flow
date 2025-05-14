
/**
 * User Service Index
 * 
 * IMPORTANT: This file uses explicit named exports ONLY to prevent unwanted
 * data fetching during module initialization. Do NOT use wildcard exports.
 */

// DO NOT export fetch-related functions here
// They should be imported directly from userFetchService.ts
// export * from './userFetchService'; // <-- REMOVED to prevent unintended importing

// Export user creation functionality
export * from './userCreationService';

// Export user modification functionality
export * from './userProfileService';

// Export user role functionality
export * from './userRoleService';

// Re-export specific functions only (no wildcard exports)
// This prevents bundlers from including all exports during tree-shaking
export { 
  // Export only what's explicitly needed
  // DO NOT export fetchUsers here - import it directly from userFetchService
  invalidateUserCache
} from './userFetchService';
