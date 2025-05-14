
/**
 * Preview mode service
 * 
 * Re-exporting from core/previewService to maintain backward compatibility
 * while preventing circular dependencies
 */
export { 
  isPreviewMode,
  simulateApiDelay,
  simulateApiCall
} from './core/previewService';

// Get mock user data for preview mode
export { 
  getMockUserData,
  getMockUsers
} from './core/mockDataService';
