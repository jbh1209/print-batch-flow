
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
  
  // Production mode - use edge function
  try {
    // Get the current session for authorization
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Authentication required to fetch users');
    }
    
    // Call the edge function to fetch users securely
    const { data, error } = await supabase.functions.invoke('get-all-users', {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });
    
    if (error) {
      console.error("Edge function error:", error);
      throw error;
    }
    
    if (!data || !Array.isArray(data)) {
      throw new Error("Invalid data format received from edge function");
    }
    
    // Map and validate the data
    const users: UserWithRole[] = data.map((user: any) => {
      return {
        id: user.id,
        email: user.email || '',
        role: validateUserRole(user.role),
        full_name: user.full_name || null,
        avatar_url: user.avatar_url || null,
        created_at: user.created_at || new Date().toISOString(),
        last_sign_in_at: user.last_sign_in_at || null
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
