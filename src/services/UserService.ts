
import { supabase, trackApiRequest } from '../integrations/supabase/client';
import { isPreviewMode, getMockUserData, simulateApiDelay } from '../services/PreviewService';
import { toast } from 'sonner';

// Type for user data
export interface UserWithRole {
  id: string;
  email: string;
  role: 'admin' | 'user';
  full_name: string | null;
  avatar_url: string | null;
  created_at?: string;
  last_sign_in_at?: string | null;
}

// Simple memory cache with expiry
let userCache: UserWithRole[] | null = null;
let lastCacheTime: number = 0;
const CACHE_EXPIRY_MS = 60000; // 1 minute

/**
 * Invalidate the user cache to force a fresh fetch
 */
export const invalidateUserCache = (): void => {
  userCache = null;
  lastCacheTime = 0;
  console.log('User cache invalidated');
};

/**
 * Validate and normalize user role
 */
export const validateUserRole = (role: unknown): 'admin' | 'user' => {
  if (typeof role === 'string' && (role === 'admin' || role === 'user')) {
    return role;
  }
  return 'user'; // Default role
};

/**
 * Securely check if a user is an admin
 */
export const checkUserIsAdmin = async (userId: string): Promise<boolean> => {
  // In preview mode, always true for testing
  if (isPreviewMode()) {
    await simulateApiDelay();
    return true;
  }

  try {
    // Use the secure RPC function 
    const { data, error } = await supabase.rpc('is_admin_secure_fixed', { 
      _user_id: userId 
    });
    
    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

/**
 * Fetch all users with consistent error handling
 */
export const fetchAllUsers = async (): Promise<UserWithRole[]> => {
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
    // Use conventional SQL query with proper type checking
    const { data, error } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        role,
        profiles!inner(
          full_name,
          avatar_url
        ),
        auth_users:user_id(
          email,
          created_at,
          last_sign_in_at
        )
      `);
    
    if (error) throw error;
    
    if (!data || !Array.isArray(data)) {
      throw new Error("Invalid data format received");
    }
    
    // Map and validate the data
    const users: UserWithRole[] = data.map(item => ({
      id: item.user_id,
      email: item.auth_users?.email || 'unknown@email.com',
      role: validateUserRole(item.role),
      full_name: item.profiles?.full_name || null,
      avatar_url: item.profiles?.avatar_url || null,
      created_at: item.auth_users?.created_at || new Date().toISOString(),
      last_sign_in_at: item.auth_users?.last_sign_in_at || null
    }));
    
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

/**
 * Create a new user with proper error handling
 */
export const createUser = async (userData: {
  email: string;
  password: string;
  full_name?: string;
  role?: 'admin' | 'user';
}): Promise<void> => {
  // In preview mode, simulate success
  if (isPreviewMode()) {
    await simulateApiDelay(800, 1500);
    invalidateUserCache(); // Clear cache
    return;
  }
  
  try {
    const { error } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        full_name: userData.full_name || ''
      }
    });
    
    if (error) throw error;
    
    // Get the user ID from the newly created user
    const { data: userData1 } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', userData.email)
      .single();
    
    if (!userData1?.id) throw new Error("Created user not found");
    
    // Set the user role if specified
    if (userData.role) {
      const { error: roleError } = await supabase.rpc('set_user_role_admin', {
        _target_user_id: userData1.id,
        _new_role: userData.role
      });
      
      if (roleError) throw roleError;
    }
    
    invalidateUserCache(); // Clear cache
    trackApiRequest(true);
  } catch (error) {
    console.error("Error creating user:", error);
    trackApiRequest(false);
    throw error;
  }
};

/**
 * Update an existing user
 */
export const updateUser = async (
  userId: string, 
  userData: { 
    full_name?: string; 
    role?: 'admin' | 'user';
  }
): Promise<void> => {
  // In preview mode, simulate success
  if (isPreviewMode()) {
    await simulateApiDelay(500, 1000);
    invalidateUserCache(); // Clear cache
    return;
  }
  
  try {
    // Update profile if needed
    if (userData.full_name !== undefined) {
      const { error } = await supabase.rpc('update_user_profile_admin', {
        _user_id: userId,
        _full_name: userData.full_name
      });
      
      if (error) throw error;
    }
    
    // Update role if needed
    if (userData.role) {
      const { error } = await supabase.rpc('set_user_role_admin', {
        _target_user_id: userId,
        _new_role: userData.role
      });
      
      if (error) throw error;
    }
    
    invalidateUserCache(); // Clear cache
    trackApiRequest(true);
  } catch (error) {
    console.error("Error updating user:", error);
    trackApiRequest(false);
    throw error;
  }
};

/**
 * Delete/revoke access for a user
 */
export const deleteUser = async (userId: string): Promise<void> => {
  // In preview mode, simulate success
  if (isPreviewMode()) {
    await simulateApiDelay(500, 1000);
    invalidateUserCache(); // Clear cache
    return;
  }
  
  try {
    const { error } = await supabase.rpc('revoke_user_role', {
      target_user_id: userId
    });
    
    if (error) throw error;
    
    invalidateUserCache(); // Clear cache
    trackApiRequest(true);
  } catch (error) {
    console.error("Error deleting user:", error);
    trackApiRequest(false);
    throw error;
  }
};

/**
 * Check if any admin exists in the system
 */
export const checkAdminExists = async (): Promise<boolean> => {
  // In preview mode, always true
  if (isPreviewMode()) {
    await simulateApiDelay(300, 700);
    return true;
  }
  
  try {
    const { data, error } = await supabase.rpc('any_admin_exists');
    
    if (error) throw error;
    trackApiRequest(true);
    return !!data;
  } catch (error) {
    console.error("Error checking admin existence:", error);
    trackApiRequest(false);
    return false;
  }
};

/**
 * Add admin role to a user
 */
export const addAdminRole = async (userId: string): Promise<void> => {
  // In preview mode, simulate success
  if (isPreviewMode()) {
    await simulateApiDelay(500, 1000);
    invalidateUserCache(); // Clear cache
    return;
  }
  
  try {
    const { error } = await supabase.rpc('add_admin_role', {
      admin_user_id: userId
    });
    
    if (error) throw error;
    
    invalidateUserCache(); // Clear cache
    trackApiRequest(true);
  } catch (error) {
    console.error("Error adding admin role:", error);
    trackApiRequest(false);
    throw error;
  }
};
