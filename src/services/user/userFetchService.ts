
import { supabase, adminClient } from '@/integrations/supabase/client';
import { UserWithRole, validateUserRole } from '@/types/user-types';
import { isPreviewMode } from '@/services/previewService';

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
 * Securely fetch all users with proper validation and authorization checks
 * @returns Promise resolving to array of users with roles
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
  
  // Get current session to ensure fresh token
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error('Authentication error: Your session has expired. Please log out and log back in.');
  }
  
  try {
    // Approach 1: Direct edge function call with enhanced security headers
    console.log('Fetching users data via edge function');
    const response = await fetch(`https://kgizusgqexmlfcqfjopk.supabase.co/functions/v1/get-all-users`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      // Add timeout for the fetch request
      signal: AbortSignal.timeout(8000)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      throw new Error("Invalid response format from edge function");
    }
    
    // Ensure role values are valid by mapping them to the allowed types
    const typedUsers = data.map((user: any) => ({
      ...user,
      role: validateUserRole(user.role)
    }));
    
    // Update cache
    userCache = typedUsers;
    lastCacheTime = now;
    
    return typedUsers;
  } catch (fetchError) {
    console.error("Direct fetch error:", fetchError);
    
    // Approach 2: Fall back to Supabase functions API
    console.log('Falling back to functions API');
    const { data, error: functionError } = await adminClient.functions.invoke('get-all-users', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (functionError) throw functionError;
    
    if (!data || !Array.isArray(data)) {
      throw new Error("Invalid data format received from functions API");
    }
    
    // Ensure role values are valid
    const typedUsers = data.map((user: any) => ({
      ...user,
      role: validateUserRole(user.role)
    }));
    
    // Update cache
    userCache = typedUsers;
    lastCacheTime = now;
    
    return typedUsers;
  }
};
