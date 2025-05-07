
import { supabase } from '@/integrations/supabase/client';
import { UserWithRole } from '@/types/user-types';
import { toast } from 'sonner';

// Request deduplication system
const pendingRequests: Record<string, Promise<any>> = {};

/**
 * Fetch all users with deduplication and caching
 */
export async function fetchUsers(forceRefresh = false): Promise<UserWithRole[]> {
  const cacheKey = 'users_data';
  const cacheDuration = 2 * 60 * 1000; // 2 minutes
  
  // Check if we already have a pending request
  const requestKey = `fetchUsers_${forceRefresh}`;
  if (pendingRequests[requestKey]) {
    console.log('Request already in progress, reusing promise');
    return pendingRequests[requestKey];
  }
  
  // Check cache first unless force refresh
  if (!forceRefresh) {
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      try {
        const { data, timestamp } = JSON.parse(cachedData);
        const now = Date.now();
        if (now - timestamp < cacheDuration) {
          console.log('Using cached user data');
          return data;
        }
      } catch (err) {
        // Invalid cache, continue with fetch
      }
    }
  }
  
  // Create the promise for this request
  const requestPromise = new Promise<UserWithRole[]>(async (resolve, reject) => {
    try {
      console.log('Fetching users from edge function');
      
      // Get fresh token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }
      
      // Call the edge function
      const { data, error } = await supabase.functions.invoke('get-all-users', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) {
        console.error('Error calling get-all-users function:', error);
        throw new Error(error.message || 'Failed to fetch users');
      }
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format');
      }
      
      console.log(`Successfully fetched ${data.length} users`);
      
      // Update cache
      localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      
      resolve(data);
    } catch (error: any) {
      console.error('Error in fetchUsers:', error);
      reject(error);
    } finally {
      // Clear the pending request after a short delay
      setTimeout(() => {
        delete pendingRequests[requestKey];
      }, 100);
    }
  });
  
  // Store the promise
  pendingRequests[requestKey] = requestPromise;
  
  return requestPromise;
}

/**
 * Check if any admin exists in the system
 */
export async function checkAdminExists(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('any_admin_exists');
    
    if (error) {
      console.error('Error checking admin existence:', error);
      throw error;
    }
    
    return !!data;
  } catch (error) {
    console.error('Error in checkAdminExists:', error);
    throw error;
  }
}

/**
 * Create a new user
 */
export async function createUser(userData: {
  email: string;
  password: string;
  full_name?: string;
  role?: string;
}): Promise<void> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          full_name: userData.full_name
        }
      }
    });
    
    if (error) throw error;
    
    if (!data.user) {
      throw new Error('User creation failed');
    }
    
    // Set role if needed (defaults to 'user' otherwise)
    if (userData.role && userData.role !== 'user') {
      await supabase.rpc('set_user_role_admin', {
        _target_user_id: data.user.id,
        _new_role: userData.role
      });
    }
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

/**
 * Update a user's profile and/or role
 */
export async function updateUser(userId: string, userData: {
  full_name?: string;
  role?: string;
}): Promise<void> {
  try {
    // Update profile if name provided
    if (userData.full_name !== undefined) {
      const { error } = await supabase.rpc('update_user_profile_admin', {
        _user_id: userId,
        _full_name: userData.full_name
      });
      
      if (error) throw error;
    }
    
    // Update role if provided
    if (userData.role) {
      const { error } = await supabase.rpc('set_user_role_admin', {
        _target_user_id: userId,
        _new_role: userData.role
      });
      
      if (error) throw error;
    }
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

/**
 * Update a user's profile specifically
 */
export async function updateUserProfile(userId: string, userData: {
  full_name?: string;
  role?: string;
}): Promise<void> {
  return updateUser(userId, userData);
}

/**
 * Remove a user's role (revoke access)
 */
export async function revokeUserAccess(userId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('revoke_user_role', {
      target_user_id: userId
    });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error revoking user access:', error);
    throw error;
  }
}

/**
 * Add admin role to a user
 */
export async function addAdminRole(userId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('set_user_role_admin', {
      _target_user_id: userId,
      _new_role: 'admin'
    });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error adding admin role:', error);
    throw error;
  }
}
