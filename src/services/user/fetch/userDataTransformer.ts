
import { UserWithRole, validateUserRole } from '@/types/user-types';

/**
 * Transform raw user data into properly typed UserWithRole objects
 * with validated roles
 */
export const transformUserData = (userData: any[]): UserWithRole[] => {
  if (!Array.isArray(userData)) {
    console.error('Invalid user data format:', userData);
    return [];
  }

  return userData.map(user => {
    // First validate the role - this returns a UserRole type
    const validRole = validateUserRole(user.role || 'user');
    
    // Create a properly typed object with the validated role
    return {
      id: user.id || '',
      email: user.email || user.id || '',
      full_name: user.full_name || null,
      avatar_url: user.avatar_url || null,
      role: validRole, // This is now properly typed as UserRole
      created_at: user.created_at || new Date().toISOString(),
      last_sign_in_at: user.last_sign_in_at || null
    };
  });
};

/**
 * Combine profile and role data into UserWithRole objects
 * Used for direct database queries
 */
export const combineProfileAndRoleData = (
  profiles: any[],
  roles: any[]
): UserWithRole[] => {
  if (!Array.isArray(profiles)) {
    return [];
  }

  return profiles.map(profile => {
    const userRole = roles?.find(r => r.user_id === profile.id);
    const validRole = validateUserRole(userRole?.role || 'user');
    
    return {
      id: profile.id,
      email: profile.id, // Limited: we don't have emails, so use id as placeholder
      full_name: profile.full_name || null,
      avatar_url: profile.avatar_url || null,
      role: validRole, // This is properly typed as UserRole
      created_at: profile.created_at,
      last_sign_in_at: null
    };
  });
};
