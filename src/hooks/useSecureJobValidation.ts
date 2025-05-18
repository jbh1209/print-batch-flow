
import { useAuth } from '@/contexts/AuthContext';
import { isPreviewMode } from '@/services/previewService';
import { toast } from 'sonner';

/**
 * Enhanced job validation hook with improved security and permissions
 */
export function useSecureJobValidation() {
  const { user, isAdmin } = useAuth();

  /**
   * Validate user for job operations with enhanced security
   * Throws error if validation fails
   */
  const validateUser = () => {
    // In preview mode, return a secure mock user
    if (isPreviewMode()) {
      console.log("Preview mode detected in useSecureJobValidation, returning mock user");
      return { id: 'preview-user-id', email: 'preview@example.com' };
    }
    
    if (!user) {
      console.error("User not authenticated in useSecureJobValidation");
      toast.error("Authentication required");
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
    
    // Check if user matches job owner or is admin
    return jobUserId === user.id || isAdmin;
  };

  /**
   * Assert that user has access, throws error if not
   * Use this for critical operations instead of just checking
   */
  const assertJobAccess = (jobUserId: string, operation: string = 'access this item') => {
    if (!hasJobAccess(jobUserId)) {
      const errorMessage = `You don't have permission to ${operation}`;
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }
    return true;
  };

  /**
   * Verify if user has admin permissions
   * Throws error if not an admin
   */
  const assertAdminAccess = () => {
    // In preview mode, grant admin access
    if (isPreviewMode()) {
      return true;
    }
    
    if (!isAdmin) {
      const errorMessage = 'Administrator privileges required';
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    return true;
  };

  return { 
    validateUser, 
    hasJobAccess, 
    assertJobAccess,
    assertAdminAccess
  };
}
