
import { User } from '@supabase/supabase-js';

/**
 * Check if the current user is allowed to modify a record
 * @param recordOwnerId The user ID of the record's owner
 * @param currentUserId The ID of the current user
 * @returns True if the user can modify the record, false otherwise
 */
export const canModifyRecord = (recordOwnerId: string | undefined, currentUserId: string | undefined): boolean => {
  // If record owner is missing, default to not allowing modifications
  if (recordOwnerId === undefined || recordOwnerId === null) {
    return false;
  }
  
  // If current user is missing, they can't modify anything
  if (currentUserId === undefined || currentUserId === null) {
    return false;
  }

  // Check if user is the owner of the record
  const isOwner = recordOwnerId === currentUserId;
  
  // For now, only owners can modify their records
  // Later we can add admin checks here if needed
  return isOwner;
};

/**
 * Checks if the user is an admin based on their role
 * This is a placeholder - implement properly when role management is added
 * @param user The user to check 
 * @returns True if the user is an admin, false otherwise
 */
export const isAdmin = (user: User | null): boolean => {
  // In the future, this would check user.app_metadata.role or similar
  // For now, just return false as there's no role implementation yet
  return false;
};

/**
 * Determines if a user can perform batch operations
 * @param user The current user
 * @returns True if the user can perform batch operations
 */
export const canPerformBatchOperations = (user: User | null): boolean => {
  // All authenticated users can perform batch operations for now
  return !!user;
};

/**
 * Determines if a user can access admin features
 * @param user The current user
 * @returns True if the user can access admin features
 */
export const canAccessAdminFeatures = (user: User | null): boolean => {
  return isAdmin(user);
};
