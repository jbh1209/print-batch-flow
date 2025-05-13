
/**
 * Centralized Security Service
 * 
 * Provides unified security operations for authentication, authorization,
 * and secure data access across development and production environments.
 */

// Import necessary dependencies
import { supabase } from '@/integrations/supabase/client';
import { UserWithRole, validateUserRole } from '@/types/user-types';
import { toast } from 'sonner';

// Simple in-memory cache for user data with expiration
let userCache: UserWithRole[] | null = null;
let lastCacheTime: number = 0;
const CACHE_EXPIRY_MS = 60000; // 1 minute

/**
 * Clear user data cache to force a fresh fetch
 */
export const invalidateUserCache = (): void => {
  userCache = null;
  lastCacheTime = 0;
  console.log('User cache invalidated');
};

/**
 * Check if we're in preview mode
 */
export const isPreviewMode = (): boolean => {
  return typeof window !== 'undefined' && 
    (window.location.hostname.includes('lovable.dev') || 
     window.location.hostname.includes('gpteng.co') ||
     window.location.hostname === 'localhost' ||
     window.location.hostname === '127.0.0.1');
};

/**
 * Get preview mock data for testing
 */
export const getPreviewMockData = (role: 'admin' | 'user') => {
  return {
    id: role === 'admin' ? "preview-admin-1" : "preview-user-1",
    email: role === 'admin' ? "admin@example.com" : "user@example.com",
    created_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    role: role,
    full_name: role === 'admin' ? "Preview Admin" : "Regular User",
    avatar_url: null
  };
};

/**
 * Clean up authentication state for secure sign out
 */
export const cleanupAuthState = () => {
  console.log('Cleaning up auth state');
  
  try {
    // Remove all Supabase auth keys from localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        console.log(`Removing auth key from localStorage: ${key}`);
        localStorage.removeItem(key);
      }
    });
    
    // Remove from sessionStorage if in use
    if (typeof sessionStorage !== 'undefined') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          console.log(`Removing auth key from sessionStorage: ${key}`);
          sessionStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.error('Error during auth state cleanup:', error);
  }
};

/**
 * Secure sign out with thorough cleanup
 */
export async function secureSignOut(): Promise<void> {
  try {
    // Clean up auth state first
    cleanupAuthState();
    
    // Attempt global sign out
    await supabase.auth.signOut({ scope: 'global' });
    
    // Force page reload for a clean state
    setTimeout(() => {
      window.location.href = '/auth';
    }, 300);
  } catch (error) {
    console.error("Error during secure sign out:", error);
    toast.error("Sign out encountered an error");
    
    // Force redirect as last resort
    window.location.href = '/auth';
  }
}

/**
 * Verify if a user has a specific role
 */
export async function verifyUserRole(userId: string, role: 'admin' | 'user'): Promise<boolean> {
  if (!userId) return false;
  
  // Auto-approve in preview mode for testing
  if (isPreviewMode()) {
    return true;
  }
  
  try {
    // Try using the secure RPC function
    const { data: rpcData, error: rpcError } = await supabase.rpc('has_role', { role });
    
    if (!rpcError && rpcData === true) {
      return true;
    }
    
    // Fallback: Direct query
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', role)
      .maybeSingle();
    
    if (!roleError && roleData) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error verifying role '${role}':`, error);
    return false;
  }
}

/**
 * Fetch all users with enhanced security
 */
export async function fetchUsers(): Promise<UserWithRole[]> {
  // Return cached data if valid
  const now = Date.now();
  if (userCache && (now - lastCacheTime < CACHE_EXPIRY_MS)) {
    return userCache;
  }
  
  // In preview mode, return mock data
  if (isPreviewMode()) {
    const mockUsers: UserWithRole[] = [
      getPreviewMockData('admin') as UserWithRole,
      getPreviewMockData('user') as UserWithRole,
      {
        id: "preview-user-2",
        email: "dev@example.com",
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        role: "user",
        full_name: "Developer User",
        avatar_url: null
      }
    ];
    
    userCache = mockUsers;
    lastCacheTime = now;
    
    return mockUsers;
  }
  
  try {
    // Approach 1: Use the secure stored procedure
    try {
      const { data, error } = await supabase.rpc('get_all_users_secure');
      
      if (error) {
        throw error;
      }
      
      if (!Array.isArray(data)) {
        throw new Error('Expected array response from get_all_users_secure function');
      }
      
      // Get roles for those users
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      if (rolesError) {
        throw rolesError;
      }
      
      // Create a map of user IDs to roles
      const roleMap = new Map();
      if (rolesData && Array.isArray(rolesData)) {
        rolesData.forEach((roleEntry) => {
          roleMap.set(roleEntry.user_id, roleEntry.role);
        });
      }
      
      // Get profiles data
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url');
      
      if (profilesError) {
        throw profilesError;
      }
      
      // Create a map of user IDs to profiles
      const profileMap = new Map();
      if (profilesData && Array.isArray(profilesData)) {
        profilesData.forEach((profile) => {
          profileMap.set(profile.id, profile);
        });
      }
      
      // Combine all the data
      const users = data.map((user: any) => {
        const profile = profileMap.get(user.id) || {};
        const role = validateUserRole(roleMap.get(user.id));
        
        return {
          id: user.id,
          email: user.email || '',
          role: role,
          full_name: profile.full_name || null,
          avatar_url: profile.avatar_url || null,
          created_at: new Date().toISOString(),
          last_sign_in_at: null
        } as UserWithRole;
      });
      
      userCache = users;
      lastCacheTime = now;
      return users;
    } catch (error) {
      throw error;
    }
  } catch (error: any) {
    console.error('Error in fetchUsers:', error);
    throw new Error(`Failed to load users: ${error.message || "Unknown error"}`);
  }
}

export const SECURITY_SERVICE_VERSION = '1.3.0';
