
import { supabase, trackApiRequest } from '@/integrations/supabase/client';
import { UserWithRole, validateUserRole } from '@/types/user-types';
import { isPreviewMode, getMockUserData, simulateApiDelay } from '@/services/previewService';

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
 * Securely fetch all users with consistent error handling
 */
export const fetchUsers = async (): Promise<UserWithRole[]> => {
  // Return cached data if valid
  const now = Date.now();
  if (userCache && (now - lastCacheTime < CACHE_EXPIRY_MS)) {
    console.log('Returning cached users data');
    return userCache;
  }
  
  // In preview mode, return mock data
  if (isPreviewMode()) {
    console.log("Preview mode detected, returning mock users data");
    await simulateApiDelay(600, 1200);
    
    const mockUsers: UserWithRole[] = [
      {
        id: "preview-admin-1",
        email: "admin@example.com",
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        role: "admin",
        full_name: "Preview Admin",
        avatar_url: null
      },
      {
        id: "preview-user-1",
        email: "user@example.com",
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        role: "user",
        full_name: "Regular User",
        avatar_url: null
      },
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
    
    // Update cache
    userCache = mockUsers;
    lastCacheTime = now;
    
    return mockUsers;
  }
  
  // Production mode - try to fetch real data
  try {
    // Use RPC function to get user data securely
    const { data: userData, error: userError } = await supabase.rpc('get_all_users_secure');
    
    if (userError) throw userError;
    
    if (!userData || !Array.isArray(userData)) {
      throw new Error("Invalid data format received");
    }
    
    // Get roles data
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');
      
    if (rolesError) throw rolesError;
    
    // Get profiles data
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url');
      
    if (profilesError) throw profilesError;
    
    // Create maps for faster lookups
    const roleMap = new Map();
    if (rolesData) {
      rolesData.forEach((role: any) => {
        roleMap.set(role.user_id, role.role);
      });
    }
    
    const profileMap = new Map();
    if (profilesData) {
      profilesData.forEach((profile: any) => {
        profileMap.set(profile.id, profile);
      });
    }
    
    // Map and validate the data
    const users: UserWithRole[] = userData.map((user: any) => {
      const profile = profileMap.get(user.id) || {};
      const role = validateUserRole(roleMap.get(user.id));
      
      return {
        id: user.id,
        email: user.email || '',
        role: role,
        full_name: profile.full_name || null,
        avatar_url: profile.avatar_url || null,
        created_at: new Date().toISOString(), // Default when not available
        last_sign_in_at: null
      };
    });
    
    // Update cache and track successful request
    userCache = users;
    lastCacheTime = now;
    trackApiRequest(true);
    
    return users;
  } catch (error) {
    console.error("Error fetching users:", error);
    trackApiRequest(false);
    throw new Error(`Failed to fetch users: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
};

// Alias functions for backward compatibility
export const fetchAllUsers = fetchUsers;
