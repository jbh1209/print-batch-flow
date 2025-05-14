
import { useAuth } from '@/contexts/AuthContext';
import { isPreviewMode } from '@/services/previewService';

/**
 * Enhanced job validation hook with improved security
 */
export function useJobValidation() {
  const { user } = useAuth();

  /**
   * Validate user for job operations with enhanced security
   */
  const validateUser = () => {
    // In preview mode, return a secure mock user
    if (isPreviewMode()) {
      console.log("Preview mode detected in useJobValidation, returning mock user");
      return { id: 'preview-user-id', email: 'preview@example.com' };
    }
    
    if (!user) {
      console.error("User not authenticated in useJobValidation");
      throw new Error('User not authenticated');
    }
    
    return user;
  };

  /**
   * Verify user has required permissions for a job operation
   * @param jobUserId The user ID associated with the job
   * @returns Boolean indicating if current user has access
   */
  const hasJobAccess = (jobUserId: string) => {
    // In preview mode, always grant access
    if (isPreviewMode()) {
      return true;
    }
    
    if (!user) {
      return false;
    }
    
    // Check if user matches job owner
    return jobUserId === user.id;
  };

  return { validateUser, hasJobAccess };
}
