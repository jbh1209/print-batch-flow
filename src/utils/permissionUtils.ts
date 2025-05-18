import { useAuth } from "@/hooks/useAuth";

/**
 * Checks if the current user can modify a record
 * @param recordUserId The user ID of the record owner
 * @returns boolean indicating if the user can modify the record
 */
export const canModifyRecord = (recordUserId: string | undefined, currentUserId: string | undefined): boolean => {
  // If no record user ID is provided, deny access
  if (!recordUserId) return false;
  
  // If no current user ID is provided, deny access
  if (!currentUserId) return false;
  
  // Check if the current user is the owner of the record
  return recordUserId === currentUserId;
};

/**
 * A React hook that provides permission checking functions
 */
export const usePermissions = () => {
  const { user, isAdmin } = useAuth();
  
  /**
   * Checks if the current user can modify a record
   * @param recordUserId The user ID of the record owner
   * @returns boolean indicating if the user can modify the record
   */
  const canModify = (recordUserId: string | undefined): boolean => {
    // Admins can modify any record
    if (isAdmin) return true;
    
    // Otherwise, only the owner can modify
    return canModifyRecord(recordUserId, user?.id);
  };
  
  return {
    canModify,
    isAdmin
  };
};
